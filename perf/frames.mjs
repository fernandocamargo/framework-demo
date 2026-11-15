// Drives the flow in perf/steps.mjs through the perf build, as perf/cycles.mjs does, and says what
// each step costs in frames instead of renders: the browser's own long animation frames (a frame
// over 50 ms), with the script time and the forced style and layout inside each, and the slowest
// interaction (Event Timing). Nothing is injected but two PerformanceObservers.
//
//   node perf/frames.mjs              on the last perf build (`npm run perf` builds it)
//   [LABEL=name] [RUNS=3] [PORT=5190] [VISIT=features] [FROM=0] [TO=28] [TRACE=1] [CATEGORIES=a,b]
//
// TRACE=1 also traces the first run (perf/out/<LABEL>/frames.trace.json, a Chrome trace with stacks
// and a CPU profile) and lists the style and layout work a script forced, by step and by the code
// that asked for it: a Layout or an UpdateLayoutTree event that carries a stack. Tracing slows the
// page, so the times of a traced run are not the page's own. CATEGORIES adds trace categories:
// `disabled-by-default-devtools.timeline.invalidationTracking`, which react-doctor's scan records
// with, keeps a stack for every element a change invalidates, and by itself makes removing a list
// of rows a task of over 100 ms.

import { chromium } from '@playwright/test';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

import { FEATURES, STEPS } from './steps.mjs';

const env = process.env;
const port = Number(env.PORT ?? 5190);
const runs = Number(env.RUNS ?? 1);
const label = env.LABEL ?? 'current';
const here = (file) => path.join(import.meta.dirname, file);
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
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(port, resolve));
const base = `http://localhost:${port}`;

const BASEMAP = /^https:\/\/(tiles\.openfreemap\.org\/styles\/|api\.maptiler\.com\/maps\/)/;
const EMPTY_STYLE = JSON.stringify({ layers: [], sources: {}, version: 8 });
const all = env.VISIT === 'features' ? FEATURES : STEPS.filter((step) => !step.further);
const steps = all.slice(Number(env.FROM ?? 0), Number(env.TO ?? all.length - 1) + 1);

/** In the page: keeps every long animation frame and every interaction the browser reports. */
const observe = () => {
  window.__frames = [];
  window.__events = [];
  const watch = (type, into, shape) => {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) into.push(shape(entry));
      }).observe({ buffered: true, durationThreshold: 16, type });
    } catch {
      // An engine without this entry type reports none.
    }
  };
  watch('long-animation-frame', window.__frames, (frame) => ({
    blocking: frame.blockingDuration,
    duration: frame.duration,
    forced: frame.scripts.reduce((sum, script) => sum + script.forcedStyleAndLayoutDuration, 0),
    render: frame.startTime + frame.duration - (frame.styleAndLayoutStart || frame.startTime + frame.duration),
    script: frame.scripts.reduce((sum, script) => sum + script.duration, 0),
    scripts: frame.scripts.map((script) => ({
      duration: script.duration,
      forced: script.forcedStyleAndLayoutDuration,
      invoker: script.invoker,
    })),
    start: frame.startTime,
  }));
  watch('event', window.__events, (event) => ({
    duration: event.duration,
    id: event.interactionId,
    name: event.name,
    start: event.startTime,
  }));
};

async function run(trace) {
  const browser = await chromium.launch(env.CHROMIUM ? { executablePath: env.CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { height: 1000, width: 1400 } });
  page.setDefaultTimeout(10_000);
  // The live map's basemap is the one thing the app asks elsewhere for: it gets a style with nothing in it.
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) =>
      BASEMAP.test(route.request().url())
        ? route.fulfill({ body: EMPTY_STYLE, contentType: 'application/json' })
        : route.abort(),
  );
  await page.addInitScript(observe);
  if (trace)
    await browser.startTracing(page, {
      categories: [
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'disabled-by-default-devtools.timeline.stack',
        'disabled-by-default-v8.cpu_profiler',
        'v8.execute',
        'blink.user_timing',
        'loading',
        ...(env.CATEGORIES ?? '').split(',').filter(Boolean),
      ],
    });
  const stamps = [];
  const misses = [];
  for (const step of steps) {
    // A step that loads a document starts the clock again: its stamp is taken as zero.
    const before = await page.evaluate(() => performance.now()).catch(() => 0);
    await step.act(page, base);
    await page.waitForFunction(() => Boolean(window.__framework?.idle));
    await page.evaluate(() => window.__framework.idle());
    const after = await page.evaluate(() => performance.now());
    stamps.push({ end: after, name: step.name, start: after < before ? 0 : before });
    if (!(await step.check(page).catch(() => false))) misses.push(step.name);
  }
  // The last frames and events are reported after the next paint.
  await page.waitForTimeout(400);
  const { events, frames } = await page.evaluate(() => ({ events: window.__events, frames: window.__frames }));
  const traced = trace ? await browser.stopTracing() : null;
  await browser.close();
  return { events, frames, misses, stamps, traced };
}

const results = [];
try {
  for (let index = 0; index < runs; index++) results.push(await run(env.TRACE === '1' && index === 0));
} finally {
  server.close();
}
mkdirSync(here(`out/${label}`), { recursive: true });
if (results[0].traced) writeFileSync(here(`out/${label}/frames.trace.json`), results[0].traced);
writeFileSync(
  here(`out/${label}/frames.json`),
  JSON.stringify(
    results.map(({ traced: _, ...rest }) => rest),
    null,
    1,
  ),
);

const within = (entry, stamp) => entry.start >= stamp.start && entry.start < stamp.end;
const lines = [];
const say = (line) => {
  lines.push(line);
  console.log(line);
};
const cell = (value, width) => String(value).padStart(width);
const ms = (value) => value.toFixed(0);
const each = (pick) => results.map(pick);
const spread = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[0] === sorted.at(-1) ? ms(sorted[0]) : `${ms(sorted[0])}–${ms(sorted.at(-1))}`;
};
say(
  `## ${label}: chromium, ${runs} run(s)${env.TRACE === '1' ? ', the first one traced' : ''}; each cell is the lowest and the highest of the runs`,
);
say('step                             long frames  longest ms  script ms  forced ms  slowest interaction ms');
const totals = results.map(() => ({ forced: 0, frames: 0, interaction: 0, longest: 0 }));
steps.forEach((step, at) => {
  const per = each((result, index) => {
    const stamp = result.stamps[at];
    const frames = result.frames.filter((frame) => within(frame, stamp));
    const events = result.events.filter((event) => event.id && within(event, stamp));
    const longest = frames.reduce((worst, frame) => (frame.duration > worst.duration ? frame : worst), {
      duration: 0,
      forced: 0,
      script: 0,
    });
    const forced = frames.reduce((sum, frame) => sum + frame.forced, 0);
    const interaction = events.reduce((worst, event) => Math.max(worst, event.duration), 0);
    const total = totals[index];
    total.frames += frames.length;
    total.forced += forced;
    total.longest = Math.max(total.longest, longest.duration);
    total.interaction = Math.max(total.interaction, interaction);
    return { forced, frames: frames.length, interaction, longest };
  });
  say(
    `${step.name.padEnd(32)} ${cell(spread(per.map((one) => one.frames)), 11)} ${cell(spread(per.map((one) => one.longest.duration)), 11)} ${cell(spread(per.map((one) => one.longest.script)), 10)} ${cell(spread(per.map((one) => one.forced)), 10)} ${cell(spread(per.map((one) => one.interaction)), 23)}`,
  );
});
say(
  `total: ${steps.length} steps; long frames ${spread(totals.map((total) => total.frames))}; the longest ${spread(totals.map((total) => total.longest))} ms; forced style and layout in them ${spread(totals.map((total) => total.forced))} ms; the slowest interaction ${spread(totals.map((total) => total.interaction))} ms; misses ${results.map((result) => result.misses.length).join(', ')}`,
);

// The style and layout a script forced in the traced run: the browser ran them inside a task, with
// a script on the stack, instead of once at the frame's end.
if (results[0].traced) {
  const events = JSON.parse(results[0].traced.toString('utf8')).traceEvents;
  const origin = events.findLast(
    (event) => event.name === 'navigationStart' && JSON.stringify(event.args ?? {}).includes(base),
  );
  const stampOf = (event) => {
    const at = (event.ts - origin.ts) / 1000;
    return results[0].stamps.findLast((stamp) => stamp.start <= at)?.name ?? '(before)';
  };
  const forced = new Map();
  for (const event of events) {
    if (event.ph !== 'X' || event.pid !== origin.pid) continue;
    if (event.name !== 'Layout' && event.name !== 'UpdateLayoutTree') continue;
    const stack = event.args?.beginData?.stackTrace ?? event.args?.stackTrace ?? [];
    if (!stack.length) continue;
    const frames = stack
      .slice(0, 3)
      .map(
        (frame) =>
          `${frame.functionName || '(anonymous)'} (${String(frame.url).split('/').pop()}:${frame.lineNumber + 1})`,
      )
      .join(' < ');
    const key = `${stampOf(event)}\n      ${frames}`;
    const entry = forced.get(key) ?? { count: 0, ms: 0 };
    entry.count += 1;
    entry.ms += (event.dur ?? 0) / 1000;
    forced.set(key, entry);
  }
  say('');
  say('forced style and layout in the traced run, 0.5 ms and over: ms, times, step, and the code that asked');
  for (const [key, entry] of [...forced].sort((a, b) => b[1].ms - a[1].ms))
    if (entry.ms >= 0.5) say(`${cell(entry.ms.toFixed(1), 6)} ${cell(entry.count, 3)}×  ${key}`);
  say(
    `total forced: ${[...forced.values()].reduce((sum, entry) => sum + entry.ms, 0).toFixed(1)} ms in ${[...forced.values()].reduce((sum, entry) => sum + entry.count, 0)} events`,
  );
}
writeFileSync(here(`out/${label}/frames.txt`), `${lines.join('\n')}\n`);
