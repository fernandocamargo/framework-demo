// The Blueprint skin is a sheet over the same markup: it names every item by its type and every
// property by its name, and it changes no element or attribute of the page or of a dialog.

import { expect, type Page, test } from '@playwright/test';

import { arrive } from '../perf/address.mjs';
import { markupWithoutLinkSkin } from './markup';

const act = async (page: Page, action: () => Promise<unknown>) => {
  await action();
  await page.evaluate(() => window.__framework.idle());
};

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

// The ids react-aria and React generate are not the markup's: they follow the order components
// render in, which a reload may change.
const markup = async (page: Page, selector = 'main') => {
  await page.mouse.move(0, 0);
  const html = await page.locator(selector).evaluate(markupWithoutLinkSkin);
  return html.replace(/react-aria\d+-/g, 'react-aria-').replace(/_r_[a-z0-9]+_/g, '_r_');
};
const pseudo = (locator: ReturnType<Page['locator']>, which: '::after' | '::before') =>
  locator.evaluate((element, part) => getComputedStyle(element, part).content, which);

test('Blueprint names the catalogue and a product, and changes no element of either', async ({ page }) => {
  await act(page, () => arrive(page, '/products'));
  const plain = await markup(page);

  await act(page, () => arrive(page, '/products', { skin: 'blueprint' }));
  expect(await page.evaluate(() => document.documentElement.dataset['skin'])).toBe('blueprint');
  expect(await markup(page)).toBe(plain);

  const firstRow = page.locator('li[itemtype$="/Product"]').first();
  const link = firstRow.getByRole('heading').getByRole('link');
  expect(await link.getAttribute('data-rac')).toBeNull();
  expect(await link.locator('[itemprop="name"]').count()).toBe(1);
  expect(await pseudo(firstRow, '::before')).toContain('Product');
});

test('Blueprint names a product dialog the same way, and shows the hidden price data', async ({ page }) => {
  await act(page, () => arrive(page, '/products/22'));
  const plain = await markup(page, '[role="dialog"]');

  await act(page, () => arrive(page, '/products/22', { skin: 'blueprint' }));
  expect(await markup(page, '[role="dialog"]')).toBe(plain);

  const article = page.getByRole('dialog').locator('article[itemtype$="/Product"]');
  expect(await pseudo(article, '::before')).toContain('Product');
  const currency = page.locator('[role="dialog"] meta[itemprop="priceCurrency"]');
  expect(await pseudo(currency, '::before')).toContain('priceCurrency');
});
