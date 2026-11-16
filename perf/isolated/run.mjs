import { chromium, expect, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build, preview } from 'vite';

import { INTERACTIONS, summarize, table, VARIANTS } from './report.mjs';

const port = Number(process.env.PORT ?? 5197);
assert(Number.isInteger(port) && port > 0 && port <= 65535, 'PORT must be an integer from 1 to 65535');
const configFile = path.join(import.meta.dirname, 'vite.config.ts');
const recorder = await readFile(new URL('../recorder.js', import.meta.url), 'utf8');
const output = path.join(import.meta.dirname, 'out');
await build({ configFile });
await mkdir(output, { recursive: true });
const server = await preview({ configFile, preview: { host: '127.0.0.1', port, strictPort: true } });
const base = `http://127.0.0.1:${port}`;

// There is no framework idle signal here. Let effects, focus and collection commits finish.
async function idle(page) {
  await page.evaluate(async () => {
    let before = window.__renders.length;
    let quiet = 0;
    for (let frame = 0; frame < 300; frame++) {
      await new Promise(requestAnimationFrame);
      const animating = document
        .getAnimations()
        .some((animation) => animation.playState === 'running' || animation.pending);
      const after = window.__renders.length;
      quiet = after === before && !animating ? quiet + 1 : 0;
      if (quiet === 3) return;
      before = after;
    }
    throw new Error('The isolated page did not reach three quiet frames');
  });
}

async function check(page, chosen) {
  const rows = page.getByRole('list', { name: 'Products' }).getByRole('listitem');
  await expect(rows).toHaveCount(12);
  const values = await rows.evaluateAll((elements) =>
    elements.map((element) => ({
      category: element.getAttribute('data-category'),
      page: Number(element.getAttribute('data-page')),
      query: element.getAttribute('data-query'),
      sort: element.getAttribute('data-sort'),
    })),
  );
  assert.deepEqual(
    values,
    Array.from({ length: 12 }, () => chosen),
  );
  await expect(page.getByRole('searchbox', { name: 'Search products' })).toHaveValue(chosen.query);
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

async function visit(browser, variant) {
  const context = await browser.newContext({ viewport: { height: 1000, width: 1400 } });
  try {
    await context.route(
      (url) => url.origin !== base,
      (route) => route.abort(),
    );
    await context.addInitScript(recorder);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/?variant=${variant}`);
    await expect(page.getByRole('heading', { name: 'Isolated catalogue filters' })).toBeVisible();
    await idle(page);
    const ready = await page.evaluate(() => ({
      components: window.__renders.flatMap((commit) => commit.components).length,
      renderers: window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size,
    }));
    assert(ready.renderers > 0 && ready.components > 0, 'The profiling renderer must connect to the recorder');
    let chosen = { category: '', page: 1, query: '', sort: 'title:asc' };
    await check(page, chosen);
    const results = [];
    for (const interaction of INTERACTIONS) {
      await page.evaluate((name) => {
        window.__phase = name;
      }, interaction);
      switch (interaction) {
        case 'choose category':
        case 'choose sort': {
          const sorting = interaction === 'choose sort';
          const label = sorting ? 'Sort' : 'Category';
          const value = sorting ? 'price:desc' : 'lighting';
          const text = sorting ? 'Price, high to low' : 'Lighting';
          if (variant === 'native') {
            await page.getByRole('combobox', { exact: true, name: label }).selectOption(value);
            await expect(page.getByRole('combobox', { exact: true, name: label })).toHaveValue(value);
          } else {
            await page.getByRole('button', { name: new RegExp(label) }).click();
            await page.getByRole('option', { exact: true, name: text }).click();
            await expect(page.getByRole('button', { name: new RegExp(label) })).toContainText(text);
          }
          chosen = { ...chosen, [sorting ? 'sort' : 'category']: value };
          break;
        }
        case 'next page':
        case 'previous page': {
          const next = interaction === 'next page';
          await page.getByRole('link', { exact: true, name: next ? 'Next' : 'Previous' }).click();
          chosen = { ...chosen, page: next ? 2 : 1 };
          break;
        }
        case 'type lamp and Enter': {
          const input = page.getByRole('searchbox', { name: 'Search products' });
          await input.pressSequentially('lamp');
          await input.press('Enter');
          chosen = { ...chosen, query: 'lamp' };
          break;
        }
        default:
          throw new Error(`Unknown interaction: ${interaction}`);
      }
      await idle(page);
      await check(page, chosen);
      results.push({ interaction, ...chosen });
    }
    await idle(page);
    assert.deepEqual(errors, [], `${variant}: page errors`);
    const commits = await page.evaluate(() => window.__renders);
    assert(
      commits.some((commit) => commit.components.some((component) => component.self > 0)),
      'The production build must record profiling durations',
    );
    return { commits, errors, results, variant };
  } finally {
    await context.close();
  }
}

try {
  for (const [engine, type, executablePath] of [
    ['chromium', chromium, process.env.CHROMIUM],
    ['webkit', webkit, process.env.WEBKIT],
  ]) {
    const browser = await type.launch(executablePath ? { executablePath } : {});
    try {
      const visits = [];
      for (const variant of VARIANTS) visits.push(await visit(browser, variant));
      const results = visits.flatMap((visit) =>
        INTERACTIONS.map((interaction) => ({
          ...summarize(visit.commits, interaction),
          variant: visit.variant,
        })),
      );
      const printed = table(engine, results);
      await writeFile(path.join(output, `${engine}.json`), `${JSON.stringify({ engine, results, visits }, null, 2)}\n`);
      await writeFile(path.join(output, `${engine}.txt`), `${printed}\n`);
      console.log(printed);
      console.log(`15 interaction checks passed; full commits and causes: perf/isolated/out/${engine}.json`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => (error ? reject(error) : resolve())));
}
