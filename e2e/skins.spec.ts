// A skin is a sheet per component folder, and nothing else: the page wears another without one
// element or attribute of its markup changing.

import { expect, type Page, test } from '@playwright/test';

const act = async (page: Page, action: () => Promise<unknown>) => {
  await action();
  await page.evaluate(() => window.__framework.idle());
};

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('another skin changes how the page looks, and not one element or attribute of it', async ({ page }) => {
  await act(page, () => page.goto('./?world=memory#/products'));
  // With the pointer out of the way: react-aria marks what it is over (data-hovered), and another
  // skin lays out other elements under it. The ids react-aria and React generate are not the
  // markup's: they follow the order components render in, which a reload may change.
  const markup = async () => {
    await page.mouse.move(0, 0);
    const html = await page.locator('main').evaluate((main) => main.outerHTML);
    return html.replace(/react-aria\d+-/g, 'react-aria-').replace(/_r_[a-z0-9]+_/g, '_r_');
  };
  const look = () =>
    page.getByRole('heading', { level: 1 }).evaluate((heading) => getComputedStyle(heading).fontFamily);
  const before = { look: await look(), markup: await markup() };
  expect(await page.evaluate(() => document.documentElement.dataset['skin'])).toBe('default');

  await act(page, () => page.getByRole('button', { name: /^Default/ }).click());
  await act(page, () => page.getByRole('option', { name: 'Broadsheet' }).click());
  expect(await page.evaluate(() => document.documentElement.dataset['skin'])).toBe('broadsheet');
  expect(new URL(page.url()).searchParams.get('skin')).toBe('broadsheet');
  expect(await look()).not.toBe(before.look);
  expect(await markup()).toBe(before.markup);

  // The address keeps it: a reload wears it again.
  await act(page, () => page.reload());
  expect(await page.evaluate(() => document.documentElement.dataset['skin'])).toBe('broadsheet');
  expect(await markup()).toBe(before.markup);
});
