// react-doctor over the app, without a person at the keyboard, and with nothing sent anywhere:
// one pinned version, run through npx (it is not a dependency), with its telemetry, its score API
// and its supply-chain lookups off.
//
//   node perf/doctor.mjs                         the static scan: findings by rule, and the runtime's
//   node perf/doctor.mjs runtime [label] [first step] [last step]
//                                                the runtime scan (a Chrome trace) over the visit's
//                                                steps, on the last perf build (`npm run perf` builds it)
//   [PORT=5191] [CDP=9334] [CHROMIUM=…]
//
// The runtime scan wants a terminal and an Enter, and its tab must be in front or the browser
// throttles it. So this starts a headless Chromium with remote debugging, runs react-doctor in a
// pseudo-terminal (Python's `pty`), plays perf/steps.mjs in react-doctor's own tab, then sends the
// Enter. Results go to perf/out/react-doctor/.
//
// Its trace keeps a stack for every element a change invalidates, which slows the page it
// measures: its long frames at a search and at a change of page are its own (perf/frames.mjs
// measures the same steps with nothing injected).

import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { STEPS } from './steps.mjs';

const VERSION = '0.9.23';
const QUIET = ['--no-telemetry', '--no-supply-chain'];
const env = { ...process.env, REACT_DOCTOR_NO_TELEMETRY: '1' };
const here = (file) => path.join(import.meta.dirname, file);
const out = here('out/react-doctor');
mkdirSync(out, { recursive: true });
const [mode = 'static', label = 'visit', from = '1', to = String(STEPS.filter((step) => !step.further).length - 1)] =
  process.argv.slice(2);

if (mode === 'static') {
  const report = path.join(out, 'report.json');
  spawnSync(
    'npx',
    ['--yes', `react-doctor@${VERSION}`, ...QUIET, '-y', '--json', '--json-out', report, '--output-dir', out],
    { cwd: here('..'), env, stdio: 'ignore' },
  );
  // What the scan finds in git-ignored output (this folder's own traces) says nothing of the app.
  const findings = JSON.parse(readFileSync(report, 'utf8')).diagnostics.filter(
    (finding) => !finding.filePath.startsWith('perf/out/') && !finding.filePath.startsWith('perf/dist/'),
  );
  const byRule = new Map();
  for (const finding of findings) byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1);
  console.log(`react-doctor ${VERSION}: ${findings.length} findings outside perf's own output`);
  for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1]))
    console.log(`${String(count).padStart(5)}  ${rule}`);
  console.log("\nin the framework's runtime:");
  for (const finding of findings.filter((each) => each.filePath.startsWith('framework/runtime/')))
    console.log(`  ${finding.rule}  ${finding.filePath}:${finding.line}  ${finding.message.split('. ')[0]}`);
  console.log(`\nthe whole report: ${report}`);
  process.exit(0);
}

const DIST = here('dist');
if (!existsSync(path.join(DIST, 'index.html')))
  throw new Error('No perf build: run `npm run perf`, or `npx vite build --config perf/vite.config.ts`');
const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const port = Number(process.env.PORT ?? 5191);
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(port, resolve));
const base = `http://localhost:${port}`;
const cdp = `http://127.0.0.1:${process.env.CDP ?? 9334}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = spawn(
  process.env.CHROMIUM ?? chromium.executablePath(),
  [
    `--remote-debugging-port=${new URL(cdp).port}`,
    `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'doctor-'))}`,
    '--no-first-run',
  ],
  { stdio: 'ignore' },
);
for (let tries = 0; ; tries++) {
  try {
    await fetch(`${cdp}/json/version`);
    break;
  } catch {
    if (tries > 50) throw new Error('Chromium did not open its debugging port');
    await wait(200);
  }
}

let said = '';
const doctor = spawn(
  'python3',
  [
    '-I',
    '-c',
    'import pty, sys; pty.spawn(sys.argv[1:])',
    'npx',
    '--yes',
    `react-doctor@${VERSION}`,
    'scan',
    `${base}/?world=memory#/products`,
    '--cdp',
    cdp,
    '--format',
    'json',
    '--trace-out',
    `${out}/${label}.trace.json.gz`,
  ],
  { env, stdio: ['pipe', 'pipe', 'pipe'] },
);
doctor.stdout.on('data', (chunk) => (said += chunk));
doctor.stderr.on('data', (chunk) => (said += chunk));
const stop = () => {
  writeFileSync(`${out}/${label}.out.txt`, said);
  doctor.kill();
  browser.kill();
  server.close();
};
process.on('exit', stop);
setTimeout(() => {
  console.log(`gave up after 6 minutes; react-doctor said:\n${said.slice(-2000)}`);
  process.exit(2);
}, 360_000).unref();

const driver = await chromium.connectOverCDP(cdp);
let page;
for (let tries = 0; !page; tries++) {
  page = driver
    .contexts()
    .flatMap((context) => context.pages())
    .find((candidate) => candidate.url().startsWith(base));
  if (tries > 300) throw new Error(`react-doctor opened no page:\n${said}`);
  if (!page) await wait(200);
}
// In front, or the tab is throttled and the framework's idle signal never comes.
await page.bringToFront();
await page.waitForFunction(() => window.__framework !== undefined, null, { timeout: 30_000 });
await page.evaluate(() => window.__framework.idle());

const steps = STEPS.filter((step) => !step.further).slice(Number(from), Number(to) + 1);
const misses = [];
const stamps = [];
for (const step of steps) {
  stamps.push({ name: step.name, start: await page.evaluate(() => performance.now()) });
  await step.act(page, base);
  await page.evaluate(() => window.__framework.idle());
  if (!(await step.check(page))) misses.push(step.name);
}
writeFileSync(`${out}/${label}.steps.json`, JSON.stringify(stamps, null, 1));

await wait(500);
doctor.stdin.write('\r');
// It prints its report, then keeps its spinner going: stop once the report is whole.
while (!/"warnings"[\s\S]*\n\}/.test(said)) await wait(500);
await wait(1000);
await driver.close().catch(() => undefined);

// A terminal's lines end with a carriage return too.
const printed = said.replaceAll('\r', '');
const report = JSON.parse(printed.slice(printed.indexOf('{\n'), printed.lastIndexOf('\n}') + 2));
writeFileSync(`${out}/${label}.json`, JSON.stringify(report, null, 1));
const { summary } = report;
const stepAt = (time) => stamps.findLast((stamp) => stamp.start <= time)?.name ?? '(the page opening)';
console.log(`${steps.length} steps (${steps[0].name} to ${steps.at(-1).name}), misses: ${misses.join(', ') || 'none'}`);
console.log(
  `interactions ${summary.interactionCount}, the slowest ${summary.worstInteractionDurationMs} ms; long frames ${summary.longAnimationFrameCount}, the longest ${Math.round(summary.worstFrameDurationMs)} ms; layout shift ${summary.cumulativeLayoutShift}; LCP ${Math.round(summary.largestContentfulPaintMs)} ms`,
);
for (const frame of [...report.longAnimationFrames].sort((a, b) => b.durationMs - a.durationMs))
  console.log(
    `${String(Math.round(frame.durationMs)).padStart(5)} ms  ${stepAt(frame.startTime)}: forced style and layout ${frame.scripts.reduce((sum, script) => sum + script.forcedStyleAndLayoutDurationMs, 0).toFixed(0)} ms`,
  );
console.log(`the report: ${out}/${label}.json; the trace: ${out}/${label}.trace.json.gz`);
process.exit(0);
