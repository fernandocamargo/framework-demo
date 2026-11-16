import { expect, type Page, test } from '@playwright/test';

import { arrive, queryOf } from '../perf/address.mjs';

const act = async (page: Page, action: () => Promise<unknown>) => {
  await action();
  await page.evaluate(() => window.__framework.idle());
};
const signIn = async (page: Page) => {
  await act(page, () => arrive(page, '/products', { signin: true }));
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await act(page, () => dialog.getByRole('button', { name: /^Emily,/ }).click());
  await act(page, () => dialog.getByRole('button', { exact: true, name: 'Sign in' }).click());
};

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('the bulk confirmation has an address, and Back and Forward keep the preview underneath', async ({ page }) => {
  await signIn(page);
  await act(page, () => page.getByRole('link', { name: 'Bulk price change' }).click());
  const wizard = page.getByRole('dialog', { name: 'Bulk price change' });
  await act(page, () => wizard.getByRole('button', { name: 'Next: the rule' }).click());
  await act(page, () => wizard.getByRole('textbox', { name: 'By' }).fill('51'));
  await act(page, () => wizard.getByRole('button', { name: 'Next: preview' }).click());
  const table = await wizard.getByRole('table').elementHandle();
  await act(page, () => wizard.getByRole('button', { name: /^Apply to/ }).click());
  expect(new URL(page.url()).pathname).toBe('/products/bulk/confirm');
  expect(await page.getByRole('alertdialog').isVisible()).toBe(true);
  expect(await table!.evaluate((element) => element.isConnected)).toBe(true);
  await act(page, () => page.goBack());
  expect(new URL(page.url()).pathname).toBe('/products/bulk');
  expect(await wizard.innerText()).toContain('Decrease by 51%');
  await act(page, () => page.goForward());
  expect(new URL(page.url()).pathname).toBe('/products/bulk/confirm');
  expect(await table!.evaluate((element) => element.isConnected)).toBe(true);
  await act(page, () => page.getByRole('button', { name: 'Back to the preview' }).click());
  expect(new URL(page.url()).pathname).toBe('/products/bulk');
  expect(queryOf(page.url())['world']).toBe('memory');
});

test('a direct confirmation resolves the chart and requires a draft before applying', async ({ page }) => {
  await signIn(page);
  await act(page, () => arrive(page, '/products/bulk/confirm'));
  const confirm = page.getByRole('alertdialog');
  expect(await confirm.isVisible()).toBe(true);
  expect(await confirm.getByRole('button', { name: 'Yes, apply it' }).isDisabled()).toBe(true);
  await act(page, () => confirm.getByRole('button', { name: 'Back to the preview' }).click());
  expect(new URL(page.url()).pathname).toBe('/products/bulk');
  expect(await page.getByRole('dialog', { name: 'Bulk price change' }).innerText()).toContain('Step 1 of 5');
});

/** Back, awaited by its own event: the address may be the same on both entries. */
const back = (page: Page) =>
  act(page, () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          window.addEventListener('popstate', () => resolve(), { once: true });
          window.history.back();
        }),
    ),
  );

test('Back passes a confirmation the wizard has left: no entry holds it', async ({ page }) => {
  await signIn(page);
  await act(page, () => page.getByRole('link', { name: 'Bulk price change' }).click());
  const wizard = page.getByRole('dialog', { name: 'Bulk price change' });
  await act(page, () => wizard.getByRole('button', { name: 'Next: the rule' }).click());
  await act(page, () => wizard.getByRole('textbox', { name: 'By' }).fill('51'));
  await act(page, () => wizard.getByRole('button', { name: 'Next: preview' }).click());
  await act(page, () => wizard.getByRole('button', { name: /^Apply to/ }).click());
  expect(new URL(page.url()).pathname).toBe('/products/bulk/confirm');
  await act(page, () => page.getByRole('button', { name: 'Yes, apply it' }).click());
  // Applied: the confirmation's entry took the wizard's address, and the summary shows.
  expect(new URL(page.url()).pathname).toBe('/products/bulk');
  expect(await wizard.innerText()).toContain('Step 5 of 5');
  // The entry the confirmation was, then the one the wizard opened on: the summary stays through both.
  await back(page);
  expect(new URL(page.url()).pathname).toBe('/products/bulk');
  expect(await wizard.innerText()).toContain('Step 5 of 5');
  await back(page);
  expect(new URL(page.url()).pathname).toBe('/products');
  expect(await wizard.count()).toBe(0);
});

test('a skin and a language change the address in place: Back does not undo them', async ({ page }) => {
  await act(page, () => arrive(page, '/products'));
  await act(page, () => page.getByRole('link', { exact: true, name: 'Report' }).click());
  const entries = await page.evaluate(() => window.history.length);
  await act(page, () => page.getByRole('combobox', { name: 'Skin' }).selectOption('broadsheet'));
  // The language is the platform's select: it is chosen, not opened.
  await act(page, () => page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR'));
  expect(queryOf(page.url())).toMatchObject({ lang: 'pt-BR', skin: 'broadsheet' });
  expect(await page.evaluate(() => window.history.length)).toBe(entries);
  await back(page);
  expect(new URL(page.url()).pathname).toBe('/products');
});

test('an address from before the routes opens its new one', async ({ page }) => {
  await act(page, () => page.goto('/?world=memory#/products?edit=4&page=2'));
  expect(new URL(page.url()).pathname).toBe('/products/4/edit');
  expect(new URL(page.url()).hash).toBe('');
  expect(queryOf(page.url())).toMatchObject({ page: 2, world: 'memory' });
  await act(page, () => page.goto('/?world=memory&lang=pt-BR#/orders?region=TX'));
  expect(new URL(page.url()).pathname).toBe('/orders');
  expect(queryOf(page.url())).toMatchObject({ lang: 'pt-BR', region: 'TX', world: 'memory' });
  await act(page, () => page.goto('/?world=memory&skin=blueprint#/states'));
  expect(new URL(page.url()).hash).toBe('#/states');
  expect(queryOf(page.url())).toMatchObject({ skin: 'blueprint', world: 'memory' });
});

test("a page's query fields do not follow to another page", async ({ page }) => {
  await act(page, () => arrive(page, '/products', { page: 3, q: 'a' }));
  await act(page, () => page.keyboard.press('ControlOrMeta+k'));
  const commands = page.getByRole('dialog', { name: 'Commands' });
  await act(page, () => commands.getByRole('menuitem', { exact: true, name: 'Report' }).click());
  expect(new URL(page.url()).pathname).toBe('/report');
  expect(queryOf(page.url())).toEqual({ v: 1, world: 'memory' });
});
