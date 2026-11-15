// The guided tour, in the memory world: each step performs what it says, and the panel is there
// over the page. Every step is: act, wait for the framework to say it is idle, then look once.

import { expect, type Locator, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { checkMicrodata, type Vocabulary } from '../framework/microdata/check';

const vocabulary = JSON.parse(
  readFileSync(new URL('../framework/microdata/vocabulary.json', import.meta.url), 'utf8'),
) as Vocabulary;

declare global {
  interface Window {
    __framework: { fromTab(): Promise<void>; idle(): Promise<void> };
  }
}

const act = async (page: Page, action: () => Promise<unknown>) => {
  await action();
  await page.evaluate(() => window.__framework.idle());
};
const open = (page: Page, hash = '#/products') => act(page, () => page.goto(`./?world=memory${hash}`));
const rows = (page: Page) => page.getByRole('list', { name: 'Products' }).locator(':scope > li');
const dialog = (page: Page, name: string) =>
  page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }));
const problems = (page: Page) => page.evaluate(checkMicrodata, vocabulary);
/** The tour's panel, wherever the locale puts its words. */
const panel = (page: Page) => page.getByRole('complementary', { name: /^(Guided tour|Tour guiado)$/ });
/** The step forward is the last command of the panel's menu, whatever its words. */
const forward = (page: Page) => panel(page).locator('menu li').last().getByRole('button');
/** The lab's toggle: it counts the faults on, as a `data` element inside it. */
const labToggle = (page: Page) => page.getByRole('button', { name: /^(Network lab|Laboratório de rede)/ });
const faults = (page: Page) => labToggle(page).locator('data').count();
const visible = (locator: Locator) => locator.isVisible();
const htmlAttribute = (page: Page, name: string) =>
  page.evaluate((attribute) => document.documentElement.getAttribute(attribute), name);

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('starting on orders shows the catalogue at the first step', async ({ page }) => {
  await open(page, '#/orders');
  expect(await rows(page).count()).toBe(0);

  await act(page, () => page.getByRole('button', { name: 'Take the tour' }).click());
  expect(await visible(panel(page))).toBe(true);
  expect(await panel(page).getByRole('heading', { name: 'The address holds the filters' }).count()).toBe(1);
  expect(new URL(page.url()).hash).toContain('#/products?');
  expect(await rows(page).count()).toBeGreaterThan(0);

  await act(page, () => panel(page).locator('header button').click());
  expect(await panel(page).count()).toBe(0);
  expect(new URL(page.url()).hash).toContain('#/products?');
});

test('the tour walks every step, does each one, and finishing it tidies the lab', async ({ page }) => {
  await open(page);
  await act(page, () => page.getByRole('button', { name: 'Take the tour' }).click());
  expect(await visible(panel(page))).toBe(true);
  // Address: the list is sorted by price.
  expect(page.url()).toContain('sort=price');

  await act(page, () => forward(page).click());
  // Product: its dialog opens over the list.
  expect(await visible(dialog(page, 'Audio Interface'))).toBe(true);

  await act(page, () => forward(page).click());
  // Slow: the address is on page 2.
  expect(page.url()).toContain('page=2');

  await act(page, () => forward(page).click());
  // Failing: the catalogue offers to try again.
  expect(await visible(page.getByRole('alert').getByRole('button', { name: /^(Try again|Tentar de novo)$/ }))).toBe(
    true,
  );

  await act(page, () => forward(page).click());
  // Healed: the list has its rows again.
  expect(await rows(page).count()).toBeGreaterThan(0);

  await act(page, () => forward(page).click());
  // Person: an admin is signed in, and the header names her.
  expect(await page.getByRole('banner').innerText()).toContain('Emily');

  await act(page, () => forward(page).click());
  // Flag: every row of an admin has the stepper's "+".
  expect(await rows(page).getByRole('button', { name: 'One more in stock' }).count()).toBeGreaterThan(0);
  expect(await problems(page)).toEqual([]);

  await act(page, () => forward(page).click());
  // Skin: the page wears the broadsheet.
  expect(await htmlAttribute(page, 'data-skin')).toBe('broadsheet');

  await act(page, () => forward(page).click());
  // Language: the page speaks Brazilian Portuguese.
  expect(await htmlAttribute(page, 'lang')).toBe('pt-BR');

  await act(page, () => forward(page).click());
  // Finished: the page keeps the broadsheet until the tour is finished.
  expect(await htmlAttribute(page, 'data-skin')).toBe('broadsheet');

  await act(page, () => forward(page).click());
  // Finishing closes the panel, tidies the lab, and puts back the skin and the language.
  expect(await panel(page).count()).toBe(0);
  expect(await htmlAttribute(page, 'data-skin')).toBe('default');
  expect(await htmlAttribute(page, 'lang')).toBe('en');
  expect(await faults(page)).toBe(0);
});

test("leaving the tour mid-way switches the lab's faults off and closes the panel", async ({ page }) => {
  await open(page);
  await act(page, () => page.getByRole('button', { name: 'Take the tour' }).click());
  // Address, product, slow, failing: the faults are on by the failing step.
  for (let step = 0; step < 3; step += 1) await act(page, () => forward(page).click());
  expect(await faults(page)).toBeGreaterThan(0);

  await act(page, () => panel(page).locator('header button').click());
  expect(await panel(page).count()).toBe(0);
  expect(await faults(page)).toBe(0);
});
