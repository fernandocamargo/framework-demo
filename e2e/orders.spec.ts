// The orders page, in the memory world: who may see it, the map of the states, the ledger of one
// state and an order's dialog, with what each role sees of the customer. Every step is: act, wait
// for the framework to say it is idle, then look once.

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
/** Does something, then waits until the app has nothing pending. */
const act = async (page: Page, action: () => Promise<unknown>) => {
  await action();
  await idle(page);
};
const open = (page: Page, path: string, query = {}) => act(page, () => arrive(page, path, query));
const problems = (page: Page) => page.evaluate(checkMicrodata, vocabulary);
const dialog = (page: Page, name: RegExp | string) => page.getByRole('dialog', { name });
/** The map's tiles: its list's own items. */
const tiles = (page: Page) => page.getByRole('list', { name: 'Orders by state' }).locator(':scope > li');
/** The ledger's rows: its list's own items. */
const ledger = (page: Page) => page.getByRole('list', { exact: true, name: 'Orders' }).locator(':scope > li');
/** The route's query slice is one JSON value. */
const fields = (page: Page) => queryOf(page.url());
const summary = (page: Page) => page.getByRole('status').first().innerText();

async function signIn(page: Page, account: string) {
  await open(page, '/orders', { signin: true });
  const form = dialog(page, 'Sign in');
  await act(page, () => form.getByRole('button', { name: new RegExp(`^${account},`) }).click());
  await act(page, () => form.getByRole('button', { name: 'Sign in' }).click());
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('as a guest, the orders page holds no map and no ledger, and asks to sign in', async ({ page }) => {
  await open(page, '/orders');
  expect(await page.getByRole('note').innerText()).toContain('Orders are for admins and moderators.');
  expect(await tiles(page).count()).toBe(0);
  expect(await ledger(page).count()).toBe(0);
  expect(await problems(page)).toEqual([]);
  const signIn = page.getByRole('link', { name: 'Sign in to see them.' });
  expect(await signIn.getAttribute('href')).toBe(visit('/orders', { signin: true }));
  expect(await signIn.getAttribute('data-rac')).toBeNull();
  await act(page, () => signIn.click());
  expect(fields(page)['signin']).toBe(true);
  expect(await dialog(page, 'Sign in').count()).toBe(1);
});

test('as a plain user, orders are told not to be theirs, and an order does not open even by its address', async ({
  page,
}) => {
  await signIn(page, 'Avery');
  await open(page, '/orders');
  expect(await page.getByRole('note').innerText()).toBe(
    'Orders are for admins and moderators, and your account cannot see them.',
  );
  expect(await tiles(page).count()).toBe(0);

  await open(page, '/orders/12');
  expect(await dialog(page, 'Order 12').count()).toBe(0);
});

test('as a moderator, the map counts the orders and a state filters the ledger and the address', async ({ page }) => {
  await signIn(page, 'Olivia');
  await open(page, '/orders');
  expect(await tiles(page).count()).toBe(51);
  expect(await summary(page)).toBe('40 orders');

  const texas = page.getByRole('link', { name: 'Texas, 3 orders' });
  expect(await texas.getAttribute('href')).toBe(visit('/orders', { region: 'TX' }));
  expect(await texas.getAttribute('data-rac')).toBeNull();
  await act(page, () => texas.click());
  expect(fields(page)['region']).toBe('TX');
  expect(await texas.getAttribute('aria-current')).toBe('true');
  expect(await summary(page)).toBe('3 orders to Texas');
  // Texas's orders are the carts of the two customers who live there (fixtures: customers 101 and 113).
  expect(await ledger(page).locator('a').allInnerTexts()).toEqual(['Order 12', 'Order 24', 'Order 36']);

  await act(page, () => page.getByRole('link', { exact: true, name: 'Order 12' }).click());
  const order = dialog(page, 'Order 12');
  expect(await order.getByRole('list', { name: 'Items' }).locator(':scope > li').count()).toBeGreaterThan(0);
  expect(await order.locator('[itemprop="addressLocality"]').innerText()).toBe('Austin');
  expect(await order.locator('[itemprop="addressRegion"]').innerText()).toBe('TX');
  expect(await order.locator('[itemprop="streetAddress"]').count()).toBe(0);
  expect(await problems(page)).toEqual([]);

  await act(page, () => page.keyboard.press('Escape'));
  expect(await dialog(page, 'Order 12').count()).toBe(0);
  expect(fields(page)['region']).toBe('TX');
});

test('as an admin, the same order shows its street and the customer in full', async ({ page }) => {
  await signIn(page, 'Emily');
  await open(page, '/orders/12', { region: 'TX' });
  const order = dialog(page, 'Order 12');
  expect(await order.locator('[itemprop="streetAddress"]').innerText()).toBe('304 Main Street');
  expect(await order.locator('[itemprop="name"]').first().innerText()).toBe('Amara Alves');
  expect(await problems(page)).toEqual([]);
});

test('ledger paging keeps the focused link when it reaches either end', async ({ page }) => {
  await signIn(page, 'Olivia');
  await open(page, '/orders');
  const nav = page.getByRole('navigation', { name: 'Pages' });
  const previous = nav.getByRole('link', { name: 'Previous' });
  const next = nav.getByRole('link', { name: 'Next' });
  const mark = (link: Locator) =>
    link.evaluate((element) => ((element as HTMLElement & { marked?: boolean }).marked = true));
  const sameAndFocused = (link: Locator) =>
    link.evaluate(
      (element) =>
        (element as HTMLElement & { marked?: boolean }).marked === true && document.activeElement === element,
    );

  await act(page, () => next.click());
  expect(fields(page)['page']).toBe(2);
  await previous.focus();
  await mark(previous);
  await act(page, () => page.keyboard.press('Enter'));
  expect(fields(page)['page']).toBeUndefined();
  await act(page, () => previous.click({ force: true }));
  expect(fields(page)['page']).toBeUndefined();
  expect(await nav.innerText()).toContain('Page 1 of 4');
  expect(await sameAndFocused(previous)).toBe(true);
  expect(await previous.getAttribute('aria-disabled')).toBe('true');
  expect(await previous.getAttribute('href')).toBeNull();
  await act(page, () => page.keyboard.press('Enter'));
  expect(fields(page)['page']).toBeUndefined();

  for (const number of ['2', '3']) {
    await act(page, () => next.click());
    expect(fields(page)['page']).toBe(Number(number));
  }
  await next.focus();
  await mark(next);
  await act(page, () => page.keyboard.press('Enter'));
  expect(fields(page)['page']).toBe(4);
  expect(await nav.innerText()).toContain('Page 4 of 4');
  expect(await sameAndFocused(next)).toBe(true);
  expect(await next.getAttribute('aria-disabled')).toBe('true');
  expect(await next.getAttribute('href')).toBeNull();
  await act(page, () => page.keyboard.press('Enter'));
  expect(fields(page)['page']).toBe(4);

  for (const skin of ['default', 'broadsheet', 'blueprint']) {
    await act(page, () => arrive(page, '/orders', { page: 4, skin: skin }));
    expect(await next.getAttribute('aria-disabled')).toBe('true');
    expect(await next.evaluate((element) => getComputedStyle(element).opacity)).toBe('0.55');
  }
});

test('the orders page is named by schema.org, and the same markup wears every skin', async ({ page }) => {
  await signIn(page, 'Olivia');
  await open(page, '/orders', { region: 'TX' });
  expect(await problems(page)).toEqual([]);

  // Attribute insertion order and generated ids can differ between navigation and a fresh mount.
  const markup = async () => {
    await page.mouse.move(0, 0);
    const html = await page.locator('main').evaluate(markupWithoutLinkSkin);
    return html.replace(/react-aria\d+-/g, 'react-aria-').replace(/_r_[a-z0-9]+_/g, '_r_');
  };
  const before = await markup();

  await arrive(page, '/orders', { region: 'TX', skin: 'broadsheet' });
  await idle(page);
  expect(await markup()).toBe(before);
});

test('the live map is off until the network lab turns it on, and the list of tiles stays', async ({ page }) => {
  await signIn(page, 'Olivia');
  await open(page, '/orders');
  expect(await page.locator('figure .maplibregl-map').count()).toBe(0);
  expect(await tiles(page).count()).toBe(51);

  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const flags = page.getByRole('complementary', { name: 'Network lab' }).getByRole('region', { name: 'Feature flags' });
  await act(page, () => page.getByRole('tab', { name: 'Flags' }).click());
  await act(page, () =>
    flags
      .getByRole('radiogroup', { name: /Live map/ })
      .getByRole('radio', { name: 'On' })
      .locator('xpath=ancestor::label')
      .click(),
  );
  expect(await tiles(page).count()).toBe(51);
  expect(await problems(page)).toEqual([]);
});
