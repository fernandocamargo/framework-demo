// Every page the flows reach names its pieces with schema.org's microdata, and the framework's
// check (framework/microdata/check.ts) finds nothing wrong with the names: a type or a property
// schema.org does not have, one the item's type does not take, or one outside any item.

import { expect, type Page, test } from '@playwright/test';
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
const open = (page: Page, hash: string) => act(page, () => page.goto(`./?world=memory${hash}`));
const problems = (page: Page) => page.evaluate(checkMicrodata, vocabulary);

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('the catalogue, a product, the editor and the dialogs name their pieces as schema.org does', async ({ page }) => {
  await open(page, '#/products');
  expect(await problems(page)).toEqual([]);

  await open(page, '#/products?signin=1');
  const signIn = page.getByRole('dialog', { name: 'Sign in' });
  await act(page, () => signIn.getByRole('button', { name: /^Emily,/ }).click());
  await act(page, () => signIn.getByRole('button', { name: 'Sign in' }).click());
  expect(await problems(page)).toEqual([]);

  for (const hash of ['#/products?view=22', '#/products?edit=22', '#/products?create=1', '#/products?remove=22']) {
    await open(page, hash);
    expect(await problems(page), hash).toEqual([]);
  }

  await open(page, '#/products?bulk=1');
  const wizard = page.getByRole('dialog', { name: 'Bulk price change' });
  await act(page, () => wizard.getByRole('button', { name: /Category/ }).click());
  await act(page, () => page.getByRole('option', { name: 'Keyboards' }).click());
  expect(await problems(page)).toEqual([]);
  await act(page, () => wizard.getByRole('button', { name: 'Next: the rule' }).click());
  await act(page, () => wizard.getByRole('button', { name: 'Next: preview' }).click());
  expect(await problems(page)).toEqual([]);
  await act(page, () => wizard.getByRole('button', { name: /^Apply to/ }).click());
  expect(await problems(page)).toEqual([]);
});

test('the network lab and its logs name their pieces as schema.org does', async ({ page }) => {
  await open(page, '#/products');
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await act(page, () => page.getByRole('link', { exact: true, name: 'Arc Floor Lamp' }).click());
  for (const tab of ['Inspector', 'Flags']) {
    await act(page, () => lab.getByRole('tab', { name: tab }).click());
    expect(await problems(page), tab).toEqual([]);
  }
  await act(page, () => page.keyboard.press('Escape'));
  await act(page, () => page.keyboard.press('?'));
  expect(await problems(page)).toEqual([]);
});
