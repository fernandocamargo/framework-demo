// The report, in the memory world: its figures and its sentences from the fixtures, its links into
// the catalogue, a count taken in another tab (the two-tab pattern of flows.spec.ts), its microdata,
// and the same markup in the Broadsheet skin. Every step is: act, wait for idle, then look once.

import { expect, type Locator, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { checkMicrodata, type Vocabulary } from '../framework/microdata/check';
import { arrive, queryOf, visit } from '../perf/address.mjs';
import { markupWithoutLinkSkin } from './markup';

const vocabulary = JSON.parse(
  readFileSync(new URL('../framework/microdata/vocabulary.json', import.meta.url), 'utf8'),
) as Vocabulary;

declare global {
  interface Window {
    __framework: { fromTab(): Promise<void>; idle(): Promise<void> };
  }
}

const idle = (page: Page) => page.evaluate(() => window.__framework.idle());

async function act(page: Page, action: () => Promise<unknown>) {
  await action();
  await idle(page);
}

const open = (page: Page, path = '/report', query = {}) => act(page, () => arrive(page, path, query));
const problems = (page: Page) => page.evaluate(checkMicrodata, vocabulary);
const headline = (page: Page) => page.getByRole('article').getByRole('heading', { level: 2 }).innerText();
/** A figure of the report: the value in the definition beside its label. */
const figure = (page: Page, label: string): Locator =>
  page
    .locator('dl > div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('dd');
const summary = (page: Page) => page.getByRole('status').first().innerText();
const dialog = (page: Page, name: RegExp | string) =>
  page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }));
const rows = (page: Page, name = 'Products') => page.getByRole('list', { name }).locator(':scope > li');

async function signIn(page: Page, account = 'Emily') {
  const form = dialog(page, 'Sign in');
  await act(page, () => form.getByRole('button', { name: new RegExp(`^${account},`) }).click());
  await act(page, () => form.getByRole('button', { name: 'Sign in' }).click());
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

for (const skin of ['default', 'broadsheet', 'blueprint']) {
  test(`the report fits a 390 px page in the ${skin} skin`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await act(page, () => arrive(page, '/report', { skin: skin }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
}

test('the report is the page the address names, with its headline and figures from the memory world', async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole('navigation').getByRole('link', { exact: true, name: 'Report' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await headline(page)).toBe('5 products are out of stock');
  expect(await page.locator('[itemprop="abstract"]').innerText()).toBe(
    '1,442 units on the shelves, worth $202,255.58. 4 more are running low.',
  );
  expect(await figure(page, 'Products').innerText()).toBe('37');
  expect(await figure(page, 'Units').innerText()).toBe('1,442');
  expect(await figure(page, 'Value').innerText()).toBe('$202,255.58');
  expect(await figure(page, 'Out of stock').innerText()).toBe('5');
  expect(await figure(page, 'Running low').innerText()).toBe('4');
  expect(await page.locator('tbody th').allInnerTexts()).toEqual(['Keyboards', 'Lighting', 'Audio', 'Desks']);
  expect(await page.locator('section[aria-labelledby="report-shortest"] li').allInnerTexts()).toHaveLength(10);
  expect(await problems(page)).toEqual([]);
});

test('a category links to the catalogue filtered by it', async ({ page }) => {
  await open(page);
  const category = page.locator('tbody').getByRole('link', { exact: true, name: 'Lighting' });
  expect(await category.getAttribute('href')).toBe(visit('/products', { category: 'lighting' }));
  expect(await category.getAttribute('data-rac')).toBeNull();
  await category.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  expect(await category.evaluate((element) => element === document.activeElement)).toBe(true);
  await act(page, () => page.keyboard.press('Enter'));
  expect(new URL(page.url()).pathname).toBe('/products');
  expect(queryOf(page.url())['category']).toBe('lighting');
  expect(await summary(page)).toBe('9 products in Lighting');
  expect(await rows(page).count()).toBe(9);
  await act(page, () => page.goBack());
  expect(new URL(page.url()).pathname).toBe('/report');
  expect(await page.getByRole('link', { exact: true, name: 'Report' }).getAttribute('aria-current')).toBe('page');
});

test('a count taken in another tab reaches the report: its units and value go up with the product', async ({
  context,
}) => {
  const report = await context.newPage();
  const other = await context.newPage();
  for (const page of [report, other])
    page.on('pageerror', (error) => {
      throw error;
    });
  await open(report);
  await open(other, '/products');
  // What another tab does arrives twice: its message on the channel, and the storage they share.
  const listen = (page: Page) =>
    page.evaluate(() => {
      const stored = new Promise<void>((resolve) =>
        window.addEventListener('storage', () => resolve(), { once: true }),
      );
      (window as unknown as { heard: Promise<unknown> }).heard = Promise.all([window.__framework.fromTab(), stored]);
    });
  const heard = async (page: Page) => {
    await page.evaluate(() => (window as unknown as { heard: Promise<void> }).heard);
    await idle(page);
  };

  await act(other, () => other.getByRole('button', { name: 'Sign in' }).click());
  await signIn(other);
  const lamp = rows(other).filter({ hasText: 'Arc Floor Lamp' });
  expect(await figure(report, 'Units').innerText()).toBe('1,442');

  await listen(report);
  await act(other, () => lamp.getByRole('button', { name: 'One more in stock' }).click());
  await heard(report);
  expect(await figure(report, 'Units').innerText()).toBe('1,443');
  expect(await figure(report, 'Value').innerText()).toBe('$202,529.57');
});

test('the report reads the same in the Broadsheet skin: another skin, and not one element of the page changes', async ({
  page,
}) => {
  // The ids react-aria and React generate follow the order components render in, not the markup.
  // The time the report was read is the clock's, so each load shows its own: it is left out.
  const markup = async () => {
    await page.mouse.move(0, 0);
    const html = await page.locator('main').evaluate(markupWithoutLinkSkin);
    return html
      .replace(/<time[\s\S]*?<\/time>/, '')
      .replace(/react-aria\d+-/g, 'react-aria-')
      .replace(/_r_[a-z0-9]+_/g, '_r_');
  };
  await open(page);
  const plain = await markup();
  await act(page, () => arrive(page, '/report', { skin: 'broadsheet' }));
  expect(await page.evaluate(() => document.documentElement.dataset['skin'])).toBe('broadsheet');
  expect(await markup()).toBe(plain);
  expect(await problems(page)).toEqual([]);
});
