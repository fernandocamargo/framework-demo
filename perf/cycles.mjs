// Drives the flow in perf/steps.mjs through the build perf/vite.config.ts makes, and counts, per
// step, the render cycles it costs:
// - calls: every call of a framework component's render, and `thrown`, those React did not commit;
// - framework: the framework components React committed, new or again, and of those rendered
//   again, how many changed nothing in the page (`no change`);
// - plumbing: the framework's own wrappers around them (Component, View);
// - other: every other component (react-aria's, the shell's).
// With DETAIL=1, each group that changed nothing says which framework component it is inside of.
// It also reports a miss for each check that failed right after `idle()`.
//
//   npm run perf                      builds, then runs the flow once in Chromium
//   node perf/cycles.mjs              runs it again on the last build
//   [LABEL=name] [RUNS=3] [CPU=4] [ENGINE=chromium|webkit] [DETAIL=1] [PORT=5190]
//
// CHROMIUM and WEBKIT may name browser executables, as for the end-to-end tests. Writes
// perf/out/<LABEL>/cycles.json (every commit of the first run) and summary.txt.

import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { chromium, webkit } from '@playwright/test'
import { STEPS } from './steps.mjs'

const env = process.env
const port = Number(env.PORT ?? 5190)
const runs = Number(env.RUNS ?? 1)
const cpu = Number(env.CPU ?? 1)
const engine = env.ENGINE ?? 'chromium'
const label = env.LABEL ?? 'current'
const here = (file) => path.join(import.meta.dirname, file)
const DIST = here('dist')
const RENDERS = new Set(['StatefulView', 'StatelessView'])
const PLUMBING = new Set(['Component', 'View'])
// The framework's wrappers carry the folder's path as their name; react-aria has a `Component` of its own.
const isPlumbing = (component) => PLUMBING.has(component.fn) && component.name !== component.fn
const recorder = readFileSync(here('recorder.js'), 'utf8')

if (!existsSync(path.join(DIST, 'index.html'))) throw new Error('No perf build: run `npm run perf`, or `npx vite build --config perf/vite.config.ts`')

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' }
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  let file = path.join(DIST, decodeURIComponent(url.pathname))
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(response)
})
await new Promise((resolve) => server.listen(port, resolve))
const base = `http://localhost:${port}`

async function run() {
  const type = engine === 'webkit' ? webkit : chromium
  const executablePath = engine === 'webkit' ? env.WEBKIT : env.CHROMIUM
  const browser = await type.launch(executablePath ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(10_000)
  // The memory world needs no network; pictures and fonts from elsewhere are left out.
  await page.route((url) => url.hostname !== 'localhost', (route) => route.abort())
  await page.addInitScript(recorder)
  if (cpu > 1 && engine === 'chromium') await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const results = []
  for (const step of STEPS) {
    await page.evaluate((name) => (window.__phase = name), step.name).catch(() => undefined)
    // A navigation starts a new document, whose recorder starts the phase at 'load'.
    await page.addInitScript((name) => (window.__phase = name), step.name)
    const started = Date.now()
    await step.act(page, base)
    await page.waitForFunction(() => Boolean(window.__framework?.idle))
    await page.evaluate(() => window.__framework.idle())
    const idleAt = Date.now() - started
    const ok = await step.check(page).catch(() => false)
    results.push({ name: step.name, ok, idleAt })
  }
  await page.waitForTimeout(300)
  // Both at once: a commit between two reads would leave its calls without it.
  const { commits, calls } = await page.evaluate(() => ({ commits: window.__renders, calls: window.__calls }))
  await browser.close()
  return { results, commits, calls, errors }
}

const summarize = ({ results, commits, calls }) =>
  results.map((step) => {
    const components = commits.filter((commit) => commit.phase === step.name).flatMap((commit) => commit.components)
    const count = (filter) => {
      const list = components.filter(filter)
      const again = list.filter((component) => !component.mounted)
      return { mounted: list.length - again.length, again: again.length, unchanged: again.filter((component) => !component.dom) }
    }
    return {
      ...step,
      commits: commits.filter((commit) => commit.phase === step.name).length,
      calls: calls.filter((call) => call.phase === step.name && !call.suspend).length,
      thrown: calls.filter((call) => call.phase === step.name && !call.suspend && !call.kept).length,
      suspends: calls.filter((call) => call.phase === step.name && call.suspend).length,
      framework: count((component) => RENDERS.has(component.fn)),
      plumbing: count(isPlumbing),
      other: count((component) => !RENDERS.has(component.fn) && !isPlumbing(component)),
      time: components.reduce((sum, component) => sum + component.self, 0),
      wasted: components.filter((component) => !component.mounted && !component.dom).reduce((sum, component) => sum + component.self, 0),
    }
  })

const all = []
try {
  for (let index = 0; index < runs; index++) all.push(await run())
} finally {
  server.close()
}
mkdirSync(here(`out/${label}`), { recursive: true })
writeFileSync(here(`out/${label}/cycles.json`), JSON.stringify(all[0], null, 1))

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const summaries = all.map(summarize)
const lines = []
const say = (line) => {
  lines.push(line)
  console.log(line)
}
say(`## ${label}: ${engine}, CPU x${cpu}, ${runs} run(s); counts from the first run`)
say('step                            idle ms  miss  calls thrown | fw new again no-change | plumbing again no-change | other new again no-change |  ms  wasted')
const blank = () => ({ steps: 0, calls: 0, thrown: 0, fwNew: 0, fwAgain: 0, fwUnchanged: 0, otherAgain: 0, otherUnchanged: 0, misses: 0, time: 0, wasted: 0 })
// The visit's steps and the further ones are totalled apart.
const visit = blank()
const further = blank()
const cell = (value, width) => String(value).padStart(width)
summaries[0].forEach((step, index) => {
  const misses = summaries.filter((summary) => !summary[index].ok).length
  const totals = STEPS[index].further ? further : visit
  totals.steps += 1
  totals.calls += step.calls
  totals.thrown += step.thrown
  totals.fwNew += step.framework.mounted
  totals.fwAgain += step.framework.again
  totals.fwUnchanged += step.framework.unchanged.length
  totals.otherAgain += step.other.again
  totals.otherUnchanged += step.other.unchanged.length
  totals.misses += misses
  totals.time += step.time
  totals.wasted += step.wasted
  say(
    `${step.name.padEnd(31)} ${cell(median(summaries.map((summary) => summary[index].idleAt)), 7)} ${cell(`${misses}/${runs}`, 5)} ${cell(step.calls, 6)} ${cell(step.thrown, 6)} |` +
      ` ${cell(step.framework.mounted, 6)} ${cell(step.framework.again, 5)} ${cell(step.framework.unchanged.length, 9)} |` +
      ` ${cell(step.plumbing.again, 14)} ${cell(step.plumbing.unchanged.length, 9)} |` +
      ` ${cell(step.other.mounted, 9)} ${cell(step.other.again, 5)} ${cell(step.other.unchanged.length, 9)} |` +
      ` ${cell(step.time.toFixed(1), 5)} ${cell(step.wasted.toFixed(1), 7)}`,
  )
  if (env.DETAIL === '1') {
    const byName = new Map()
    for (const component of [...step.framework.unchanged, ...step.other.unchanged]) {
      const cause =
        component.why?.cause === 'props'
          ? `props ${component.why.changed.map((change) => `${change.key}${change.sameValue ? '≈' : ''}`).join(',')}`
          : component.why?.cause === 'own'
            ? `own${component.why.hooks?.length ? ` hooks ${component.why.hooks.join(',')}` : ''}${component.why.contexts?.length ? ` contexts ${component.why.contexts.join(',')}` : ''}`
            : component.why?.cause
      const key = `${RENDERS.has(component.fn) ? '' : `  (in ${(component.within || 'the shell').replace('components/', '')}) `}${component.name} ← ${cause}`
      byName.set(key, (byName.get(key) ?? 0) + 1)
    }
    for (const [key, value] of [...byName].sort((a, b) => b[1] - a[1]).slice(0, Number(env.TOP ?? 8))) say(`      ${String(value).padStart(4)}× ${key}`)
  }
})
const total = (name, totals) =>
  say(
    `${name}: ${totals.steps} steps, ${totals.misses} misses; ${totals.calls} render calls, ${totals.thrown} of them thrown away; framework mounted ${totals.fwNew}, rendered again ${totals.fwAgain}, ${totals.fwUnchanged} with no change; ` +
      `other rendered again ${totals.otherAgain}, ${totals.otherUnchanged} with no change; render time ${totals.time.toFixed(1)} ms, ${totals.wasted.toFixed(1)} ms of it changing nothing`,
  )
total('total', visit)
if (further.steps) total('further', further)
if (all.some((run) => run.errors.length)) say(`page errors: ${[...new Set(all.flatMap((run) => run.errors))].join(' | ')}`)
writeFileSync(here(`out/${label}/summary.txt`), `${lines.join('\n')}\n`)
