// The main flows, in the memory world. Every step is: act, wait for the framework to say it is
// idle, then look once. No sleeps, no polling for selectors, no retried assertions: `idle()`
// resolves when no read or write is pending, no view or skin is loading, no operation is
// running and no placeholder is on screen.

import { expect, type Locator, type Page, test } from '@playwright/test';
import { readdirSync } from 'node:fs';

import { arrive, moveTo, queryOf, visit } from '../perf/address.mjs';

declare global {
  interface Window {
    __framework: { fromTab(): Promise<void>; idle(): Promise<void> };
  }
}

/** Every component folder with a chart: what the states gallery must show, one region each. */
const CHARTS = readdirSync(new URL('../src/components', import.meta.url), { recursive: true }).filter(
  (file) => String(file).split(/[\\/]/).pop() === 'state.ts',
).length;

const idle = (page: Page) => page.evaluate(() => window.__framework.idle());

/** Does something, then waits until the app has nothing pending. */
async function act(page: Page, action: () => Promise<unknown>) {
  await action();
  await idle(page);
}

const open = (page: Page, path = '/products', query = {}) => act(page, () => arrive(page, path, query));
/** A list's own items, not the items of lists inside them (a row's commands). */
const rows = (page: Page, name = 'Products') => page.getByRole('list', { name }).locator(':scope > li');
/** Each row's title: the link in its heading. */
const titles = (page: Page) => rows(page).getByRole('heading').getByRole('link').allInnerTexts();
const summary = (page: Page) => page.getByRole('status').first().innerText();
const dialog = (page: Page, name: RegExp | string) =>
  page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }));
const visible = (locator: Locator) => locator.isVisible();
/** react-aria keeps a radio's or a checkbox's real input visually hidden inside its label, so the label is what a person clicks. */
const choose = (locator: Locator) => locator.locator('xpath=ancestor::label').click();

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
  for (const locale of ['en', 'pt-BR']) {
    test(`native demo accounts fill without submitting in ${skin}, ${locale}`, async ({ page }) => {
      await act(page, () => page.goto(visit('/products', { lang: locale, signin: true, skin })));
      const signIn = dialog(page, locale === 'en' ? 'Sign in' : 'Entrar');
      const username = signIn.getByRole('textbox', { name: locale === 'en' ? 'Username' : 'Usuário' });
      const password = signIn.getByLabel(locale === 'en' ? 'Password' : 'Senha', { exact: true });
      const usernameNode = await username.elementHandle();
      const passwordNode = await password.elementHandle();

      for (const [name, login, secret] of [
        ['Emily', 'emilys', 'emilyspass'],
        ['Olivia', 'oliviaw', 'oliviawpass'],
        ['Avery', 'averyp', 'averyppass'],
      ]) {
        const button = signIn.getByRole('button', { name: new RegExp(`^${name},`) });

        expect(await button.getAttribute('type')).toBe('button');
        expect(await button.getAttribute('data-rac')).toBeNull();

        for (const activation of ['pointer', 'Enter', 'Space']) {
          await act(page, () => username.fill('draft'));
          await act(page, () => password.fill('draft'));
          await act(page, async () => {
            if (activation === 'pointer') await button.click();
            else {
              await button.focus();
              expect(await button.evaluate((element) => element === document.activeElement)).toBe(true);
              await page.keyboard.press(activation);
            }
          });
          expect(await username.inputValue()).toBe(login);
          expect(await password.inputValue()).toBe(secret);
          expect(await username.evaluate((field, original) => field === original, usernameNode)).toBe(true);
          expect(await password.evaluate((field, original) => field === original, passwordNode)).toBe(true);
          expect(queryOf(page.url())['signin']).toBe(true);
        }
      }

      await act(page, () => page.keyboard.press('Escape'));
      await act(page, () =>
        page.getByRole('button', { name: locale === 'en' ? 'Network lab' : 'Laboratório de rede' }).click(),
      );
      const lab = page.getByRole('complementary', { name: locale === 'en' ? 'Network lab' : 'Laboratório de rede' });
      await act(page, () => lab.getByRole('tab', { name: locale === 'en' ? 'Inspector' : 'Inspetor' }).click());
      expect(
        await lab
          .getByRole('listitem')
          .filter({ hasText: 'components/session/components/demo-account/handlers.ts' })
          .count(),
      ).toBe(9);
    });
  }
}

test('demo accounts remain available while signing in, and the pending flow ignores another fill', async ({ page }) => {
  await act(page, () => page.goto(`${visit('/products')}#/states/components%2Fsession/signingIn`));
  const signIn = dialog(page, 'Sign in');

  for (const name of ['Emily', 'Olivia', 'Avery'])
    expect(await signIn.getByRole('button', { name: new RegExp(`^${name},`) }).isEnabled()).toBe(true);

  await act(page, () => signIn.getByRole('button', { name: /^Olivia,/ }).click());
  expect(await signIn.getByRole('textbox', { name: 'Username' }).inputValue()).toBe('emilys');
  expect(await signIn.getByLabel('Password', { exact: true }).inputValue()).toBe('emilyspass');
});

test('the catalogue follows the address: search, category, sort and page', async ({ page }) => {
  await open(page);
  expect(await summary(page)).toBe('37 products');
  expect(await rows(page).count()).toBe(12);

  await act(page, async () => {
    await page.getByRole('searchbox', { name: 'Search products' }).fill('lamp');
    await page.keyboard.press('Enter');
  });
  expect(queryOf(page.url())['q']).toBe('lamp');
  expect(await summary(page)).toBe('3 products matching “lamp”');
  expect(await titles(page)).toEqual(['Arc Floor Lamp', 'Clamp Lamp', 'Task Lamp']);

  const sort = page.getByRole('combobox', { name: 'Sort' });
  await act(page, () => sort.selectOption('price:desc'));
  expect(queryOf(page.url())).toMatchObject({ order: 'desc', sort: 'price' });
  expect(await titles(page)).toEqual(['Arc Floor Lamp', 'Clamp Lamp', 'Task Lamp']);

  await page.getByRole('combobox', { name: 'Category' }).focus();
  await page.keyboard.press('Tab');
  expect(await sort.evaluate((element) => element === document.activeElement)).toBe(true);
  // Native select keyboard selection follows the platform, so choose the option directly.
  await act(page, () => sort.selectOption('price:asc'));
  expect(await sort.inputValue()).toBe('price:asc');
  expect(queryOf(page.url())['sort']).toBe('price');
  expect(queryOf(page.url())['order']).toBeUndefined();
  expect(await titles(page)).toEqual(['Task Lamp', 'Clamp Lamp', 'Arc Floor Lamp']);

  await act(page, () => page.getByRole('button', { name: 'Clear the search' }).click());
  await act(page, () => page.getByRole('combobox', { name: 'Category' }).selectOption('desks'));
  expect(await summary(page)).toBe('10 products in Desks');

  await open(page, '/products', { page: 4 });
  expect(await rows(page).count()).toBe(1);
  await act(page, () => page.goBack());
  expect(await summary(page)).toBe('10 products in Desks');
});

for (const skin of ['default', 'broadsheet', 'blueprint']) {
  test(`native catalogue choices follow the address in ${skin}`, async ({ page }) => {
    await act(page, () => arrive(page, '/products', { page: 2, skin }));
    const category = page.getByRole('combobox', { name: 'Category' });
    const sort = page.getByRole('combobox', { name: 'Sort' });

    await act(page, () => category.selectOption('lighting'));
    expect(await category.inputValue()).toBe('lighting');
    expect(queryOf(page.url())['page']).toBeUndefined();
    expect(await summary(page)).toBe('9 products in Lighting');
    await act(page, () => sort.selectOption('rating:desc'));
    expect(await sort.locator('option:checked').innerText()).toBe('Rating, best first');
    expect(queryOf(page.url())).toMatchObject({ order: 'desc', sort: 'rating' });
    await act(page, () => category.selectOption('all'));
    expect(await summary(page)).toBe('37 products');
    expect(queryOf(page.url())['category']).toBeUndefined();
    await act(page, () => page.goBack());
    expect(await category.inputValue()).toBe('lighting');
    expect(await sort.inputValue()).toBe('rating:desc');
    await act(page, () => page.goForward());
    expect(await category.inputValue()).toBe('all');
  });
}

for (const skin of ['default', 'broadsheet', 'blueprint']) {
  const settings = skin === 'default' ? {} : { skin };

  test(`native product links keep browser navigation and guest permissions in ${skin}`, async ({ context, page }) => {
    await act(page, () => arrive(page, '/products', { q: 'lamp', skin, sort: 'price' }));
    const link = rows(page).getByRole('link', { exact: true, name: 'Arc Floor Lamp' });
    const source = page.url();
    const href = visit('/products/22', { ...settings, q: 'lamp', sort: 'price' });
    const destination = new URL(href, source).href;
    expect(await link.getAttribute('href')).toBe(href);
    expect(await link.getAttribute('data-rac')).toBeNull();

    await act(page, () => link.click({ button: 'right' }));
    expect(page.url()).toBe(source);
    await page.keyboard.press('Escape');

    const opened = context.waitForEvent('page');
    await link.click({ modifiers: ['ControlOrMeta'] });
    const other = await opened;
    // The new tab's initial blank document may have already fired load.
    await other.waitForURL(destination, { waitUntil: 'load' });
    await idle(other);
    expect(other.url()).toBe(destination);
    expect(await dialog(other, 'Arc Floor Lamp').count()).toBe(1);
    expect(page.url()).toBe(source);
    await other.close();
    await page.bringToFront();

    await link.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await link.evaluate((element) => element === document.activeElement)).toBe(true);
    await act(page, () => page.keyboard.press('Enter'));
    expect(page.url()).toBe(destination);
    await act(page, () => page.goBack());
    expect(page.url()).toBe(source);
    await act(page, () => page.goForward());
    expect(page.url()).toBe(destination);
    await act(page, () => page.goBack());
    await act(page, () => page.getByRole('link', { name: 'Edit Arc Floor Lamp' }).click());
    expect(page.url()).toBe(
      new URL(visit('/products/22/edit', { ...settings, q: 'lamp', sort: 'price' }), source).href,
    );
    expect(await dialog(page, 'Sign in').innerText()).toContain('Sign in to change the catalogue.');
  });

  test(`the stock group keeps its name and current row actions after sorting in ${skin}`, async ({ page }) => {
    await act(page, () => arrive(page, '/products', { q: 'lamp', signin: true, skin }));
    await signIn(page);
    const lamp = rows(page).filter({ hasText: 'Arc Floor Lamp' });
    const group = lamp.getByRole('group', { exact: true, name: 'Stock of Arc Floor Lamp' });
    const node = await group.elementHandle();
    expect(await group.evaluate((element) => element.tagName)).toBe('DIV');
    // A flex item computes inline-flex to flex; its buttons still share one row.
    expect(await group.evaluate((element) => getComputedStyle(element).display)).toBe('flex');
    expect(await group.getByRole('button', { name: 'One less in stock' }).count()).toBe(1);
    expect(await group.getByRole('button', { name: 'One more in stock' }).count()).toBe(1);

    await act(page, () => page.getByRole('combobox', { name: 'Sort' }).selectOption('price:asc'));
    expect(await titles(page)).toEqual(['Task Lamp', 'Clamp Lamp', 'Arc Floor Lamp']);
    expect(await group.evaluate((element, original) => element === original, node)).toBe(true);
    await act(page, () => group.getByRole('button', { name: 'One more in stock' }).click());
    expect(await lamp.locator('[itemprop="inventoryLevel"]').getAttribute('value')).toBe('59');
    await act(page, () => group.getByRole('button', { name: 'One less in stock' }).click());
    expect(await lamp.locator('[itemprop="inventoryLevel"]').getAttribute('value')).toBe('58');
    expect(await group.getAttribute('aria-busy')).toBeNull();
    expect(await lamp.getByRole('link', { name: 'Edit Arc Floor Lamp' }).getAttribute('href')).toBe(
      visit('/products/22/edit', { ...settings, q: 'lamp', sort: 'price' }),
    );
    await node?.dispose();
  });
}

test('paging keeps the focused link when it reaches either end', async ({ page }) => {
  await open(page);
  const nav = page.getByRole('navigation', { name: 'Pages' });
  const previous = nav.getByRole('link', { name: 'Previous' });
  const next = nav.getByRole('link', { name: 'Next' });
  const pageNumber = () => queryOf(page.url())['page'];
  const mark = (link: Locator) =>
    link.evaluate((element) => ((element as HTMLElement & { marked?: boolean }).marked = true));
  const sameAndFocused = (link: Locator) =>
    link.evaluate(
      (element) =>
        (element as HTMLElement & { marked?: boolean }).marked === true && document.activeElement === element,
    );

  await act(page, () => next.click());
  expect(pageNumber()).toBe(2);
  await previous.focus();
  await mark(previous);
  await act(page, () => page.keyboard.press('Enter'));
  expect(pageNumber()).toBeUndefined();
  await act(page, () => previous.click({ force: true }));
  expect(pageNumber()).toBeUndefined();
  expect(await nav.innerText()).toContain('Page 1 of 4');
  expect(await sameAndFocused(previous)).toBe(true);
  expect(await previous.getAttribute('aria-disabled')).toBe('true');
  expect(await previous.getAttribute('href')).toBeNull();
  await act(page, () => page.keyboard.press('Enter'));
  expect(pageNumber()).toBeUndefined();

  for (const number of [2, 3]) {
    await act(page, () => next.click());
    expect(pageNumber()).toBe(number);
  }
  await next.focus();
  await mark(next);
  await act(page, () => page.keyboard.press('Enter'));
  expect(pageNumber()).toBe(4);
  expect(await nav.innerText()).toContain('Page 4 of 4');
  expect(await sameAndFocused(next)).toBe(true);
  expect(await next.getAttribute('aria-disabled')).toBe('true');
  expect(await next.getAttribute('href')).toBeNull();
  await act(page, () => page.keyboard.press('Enter'));
  expect(pageNumber()).toBe(4);

  for (const skin of ['default', 'broadsheet', 'blueprint']) {
    await act(page, () => arrive(page, '/products', { page: 4, skin: skin }));
    expect(await next.getAttribute('aria-disabled')).toBe('true');
    expect(await next.evaluate((element) => getComputedStyle(element).opacity)).toBe('0.55');
  }
});

test('a search keeps its field and the focus; the back button takes the text back', async ({ page }) => {
  await open(page);
  const search = page.getByRole('searchbox', { name: 'Search products' });
  const focused = () => search.evaluate((element) => element === document.activeElement);
  // Marks the field, to tell whether a search mounts another one.
  await search.evaluate((element) => ((element as HTMLElement & { marked?: boolean }).marked = true));
  const same = () => search.evaluate((element) => (element as HTMLElement & { marked?: boolean }).marked === true);

  await act(page, async () => {
    await search.fill('lamp');
    await page.keyboard.press('Enter');
  });
  expect(queryOf(page.url())['q']).toBe('lamp');
  expect(await summary(page)).toBe('3 products matching “lamp”');
  expect(await same()).toBe(true);
  expect(await focused()).toBe(true);

  // Typing goes on in the same field, and a second search keeps it too.
  await act(page, async () => {
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('desk');
    await page.keyboard.press('Enter');
  });
  expect(queryOf(page.url())['q']).toBe('desk');
  expect(await search.inputValue()).toBe('desk');
  expect(await same()).toBe(true);
  expect(await focused()).toBe(true);

  // The address goes back, and the field's text with it.
  await act(page, () => page.goBack());
  expect(await summary(page)).toBe('3 products matching “lamp”');
  expect(await search.inputValue()).toBe('lamp');
  await act(page, () => page.goBack());
  expect(await summary(page)).toBe('37 products');
  expect(await search.inputValue()).toBe('');

  // Clearing it searches for everything, and keeps the field too.
  await act(page, async () => {
    await search.fill('lamp');
    await page.keyboard.press('Enter');
  });
  await act(page, () => page.getByRole('button', { name: 'Clear the search' }).click());
  expect(await summary(page)).toBe('37 products');
  expect(await search.inputValue()).toBe('');
  expect(await same()).toBe(true);
  expect(await focused()).toBe(true);

  await act(page, () => search.fill('draft'));
  await act(page, () => search.press('Escape'));
  expect(await search.inputValue()).toBe('');
  expect(await summary(page)).toBe('37 products');
  expect(await focused()).toBe(true);
});

test('a product opens with its reviews, each from its own read', async ({ page }) => {
  await open(page);
  await act(page, () => page.getByRole('link', { exact: true, name: 'Audio Interface' }).click());
  expect(new URL(page.url()).pathname).toBe('/products/4');
  const detail = dialog(page, 'Audio Interface');
  expect(await visible(detail)).toBe(true);
  expect(await detail.getByRole('region', { name: 'Reviews' }).getByRole('listitem').count()).toBe(3);
  await act(page, () => page.keyboard.press('Escape'));
  expect(new URL(page.url()).pathname).toBe('/products');
});

test('the product and order details expose busy content only while their reads are pending', async ({ page }) => {
  await open(page, '/products', { signin: true });
  await signIn(page);
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await act(page, async () => {
    await lab.getByRole('slider', { name: 'Latency' }).focus();
    for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowRight');
  });
  await act(page, () => lab.getByRole('button', { name: 'Close the network lab' }).click());

  const pending = async (loading: string, loaded: string, action: () => Promise<unknown>) => {
    await action();
    const waiting = dialog(page, loading);
    await waiting.waitFor();
    expect(await waiting.getAttribute('aria-busy')).toBeNull();
    expect(await waiting.getByRole('article', { name: loading }).getAttribute('aria-busy')).toBe('true');
    expect(await waiting.locator('[aria-hidden="true"]').count()).toBe(3);
    await idle(page);
    expect(await dialog(page, loaded).locator('[aria-busy="true"]').count()).toBe(0);
  };

  await pending('Reading the product', 'Audio Interface', () =>
    page.getByRole('link', { exact: true, name: 'Audio Interface' }).click(),
  );
  // History navigation keeps the lab's latency in this page for the order read.
  await pending('Reading the order', 'Order 12', () => moveTo(page, visit('/orders/12')));
});

test('editing needs a session; a save makes the list read again', async ({ page }) => {
  await open(page);
  await act(page, () => page.getByRole('link', { name: 'Edit Audio Interface' }).click());
  expect(await dialog(page, 'Sign in').innerText()).toContain('Sign in to change the catalogue.');
  await signIn(page);

  const editor = dialog(page, 'Edit Audio Interface');
  expect(await visible(editor)).toBe(true);
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill('Audio Interface Mk II'));
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click());
  expect(await visible(editor)).toBe(false);
  expect(await rows(page).nth(1).innerText()).toContain('Audio Interface Mk II');
  expect(await rows(page).nth(1).innerText()).toContain('Edited');
});

test('closing with unsaved changes asks first; a form with problems is not sent', async ({ page }) => {
  await open(page, '/products/4/edit');
  await signIn(page);
  const editor = dialog(page, 'Edit Audio Interface');
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill(''));
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click());
  expect(await editor.innerText()).toContain('A product needs a title.');

  await act(page, () => page.keyboard.press('Escape'));
  const question = dialog(page, 'Discard your changes?');
  expect(await visible(question)).toBe(true);
  await act(page, () => question.getByRole('button', { name: 'Keep editing' }).click());
  expect(await visible(editor)).toBe(true);
  await act(page, () => page.keyboard.press('Escape'));
  await act(page, () => question.getByRole('button', { name: 'Discard' }).click());
  expect(new URL(page.url()).pathname).toBe('/products');
  expect(await rows(page).nth(1).innerText()).toContain('Audio Interface');
});

test('a save after somebody else saved is a conflict, and the person chooses', async ({ page }) => {
  await open(page);
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  await act(page, () => page.getByRole('link', { name: 'Edit Boom Arm' }).click());
  await signIn(page);
  const editor = dialog(page, 'Edit Boom Arm');
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill('Boom Arm, long'));
  await act(page, () => page.getByRole('button', { name: 'Sell out the product being edited' }).click());
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click());
  expect(await editor.innerText()).toContain('Somebody else changed this product');

  // Taking the newer version reads the product again: the title is back, and the stock is gone.
  await act(page, () => editor.getByRole('button', { name: 'Discard mine and reload' }).click());
  expect(await editor.getByRole('textbox', { name: 'Title' }).inputValue()).toBe('Boom Arm');
  expect(await editor.getByRole('textbox', { name: 'Stock' }).inputValue()).toBe('0');

  // The same change again, now on the newer version, is saved.
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill('Boom Arm, long'));
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click());
  expect(await visible(editor)).toBe(false);
  expect(await rows(page).filter({ hasText: 'Boom Arm, long' }).innerText()).toContain('Out of stock');
});

test('a product is created, then deleted after a confirmation', async ({ page }) => {
  await open(page, '/products', { signin: true });
  await signIn(page);
  await act(page, () => page.getByRole('link', { name: 'New product' }).click());
  const editor = dialog(page, 'New product');
  await editor.getByRole('textbox', { name: 'Title' }).fill('Cork Coaster');
  await editor.getByRole('button', { name: /Category/ }).click();
  await page.getByRole('listbox', { name: 'Category' }).getByRole('option', { name: 'Desks' }).click();
  await editor.getByRole('textbox', { name: 'Price' }).fill('7.5');
  await act(page, () => editor.getByRole('button', { name: 'Create product' }).click());
  expect(await summary(page)).toBe('38 products');
  expect(await rows(page).first().innerText()).toContain('Cork Coaster');
  expect(await rows(page).first().innerText()).toContain('New');

  await act(page, () => page.getByRole('link', { name: 'Delete Cork Coaster' }).click());
  const question = dialog(page, 'Delete Cork Coaster?');
  expect(await visible(question)).toBe(true);
  await act(page, () => question.getByRole('button', { name: 'Delete' }).click());
  expect(await summary(page)).toBe('37 products');
  expect(await titles(page)).not.toContain('Cork Coaster');
});

test('the bulk price change applies a rule, lists what failed, and sends the failed ones again', async ({ page }) => {
  await open(page, '/products', { category: 'keyboards', signin: true });
  await signIn(page);
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await act(page, () => page.getByRole('link', { name: 'Bulk price change' }).click());
  const wizard = dialog(page, 'Bulk price change');

  await act(page, async () => {
    await wizard.getByRole('button', { name: /Category/ }).click();
    await page.getByRole('listbox', { name: 'Category' }).getByRole('option', { name: 'Keyboards' }).click();
  });
  expect(await wizard.innerText()).toContain('9 of 9 products selected');
  await act(page, () => choose(wizard.getByRole('checkbox', { name: /Coiled Cable/ })));
  await act(page, () => wizard.getByRole('button', { name: 'Next: the rule' }).click());
  await act(page, () => wizard.getByRole('textbox', { name: 'By' }).fill('20'));
  await act(page, () => wizard.getByRole('button', { name: 'Next: preview' }).click());
  expect(await wizard.getByRole('row').count()).toBe(9);

  // Every request fails while the rule is applied: each product is tried, and each failure kept.
  await act(page, () => lab.getByRole('radio', { name: '500' }).check());
  await act(page, () => wizard.getByRole('button', { name: 'Apply to 8' }).click());
  expect(await wizard.innerText()).toContain('0 prices changed, 8 failed.');

  await act(page, () => lab.getByRole('radio', { name: 'As it should' }).check());
  await act(page, () => wizard.getByRole('button', { name: 'Try the 8 failed again' }).click());
  expect(await wizard.innerText()).toContain('8 prices changed.');
  await act(page, () => wizard.getByRole('button', { name: 'Done' }).click());
  // Low-Profile Keyboard: $220.99 less 20%.
  expect(await rows(page).filter({ hasText: 'Low-Profile Keyboard' }).innerText()).toContain('$176.79');
});

test('a failed read shows the error file and reaches the failure pipeline; trying again recovers', async ({ page }) => {
  await open(page);
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await act(page, () => lab.getByRole('radio', { name: '500' }).check());
  await act(page, () => arrive(page, '/products', { category: 'audio' }));
  expect(await page.getByRole('alert').first().innerText()).toContain('The catalogue could not be read');
  expect(await page.getByRole('region', { name: /Failures/ }).innerText()).toContain('service · products.search');

  await act(page, () => lab.getByRole('radio', { name: 'As it should' }).check());
  await act(page, () => page.getByRole('button', { name: 'Try again' }).click());
  expect(await summary(page)).toBe('9 products in Audio');
});

test('an expired access token is refreshed once, under the save that met it', async ({ page }) => {
  await open(page, '/products', { signin: true });
  await signIn(page);
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await act(page, () => lab.getByRole('button', { name: 'Expire the access token' }).click());
  await act(page, () => page.getByRole('link', { name: 'Edit Boom Arm' }).click());
  const editor = dialog(page, 'Edit Boom Arm');
  await act(page, () => editor.getByRole('textbox', { name: 'Brand' }).fill('Northlight Audio'));
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click());
  expect(await visible(editor)).toBe(false);
  expect(await rows(page).filter({ hasText: 'Boom Arm' }).innerText()).toContain('Northlight Audio');
  // The lab reads the client's activity once a second while it is open.
  await expect(lab.getByRole('list', { name: "The API client's latest requests" })).toContainText(
    'refreshing the access token',
  );

  // With the refresh token revoked as well, the next save ends the session.
  await act(page, () => lab.getByRole('button', { name: 'Expire the access token' }).click());
  await act(page, () => lab.getByRole('button', { name: 'Revoke the refresh token' }).click());
  await act(page, () => page.getByRole('link', { name: 'Edit Boom Arm' }).click());
  await act(page, () => editor.getByRole('textbox', { name: 'Brand' }).fill('Northlight'));
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click());
  expect(await editor.innerText()).toContain('Your session has expired');
});

test('the page speaks Brazilian Portuguese, and changes language in place', async ({ page }) => {
  await act(page, () => arrive(page, '/products', { lang: 'pt-BR' }));
  expect(await page.locator('html').getAttribute('lang')).toBe('pt-BR');
  expect(await summary(page)).toBe('37 produtos');
  expect(await page.getByRole('combobox', { exact: true, name: 'Categoria' }).inputValue()).toBe('all');
  expect(await page.getByRole('combobox', { name: 'Ordenar' }).locator('option:checked').innerText()).toBe(
    'Título, de A a Z',
  );
  // Prices and ratings are written the Brazilian way; DummyJSON's product names are not translated.
  expect(await rows(page, 'Produtos').first().innerText()).toMatch(/US\$\s273,99/);
  expect(await rows(page, 'Produtos').first().innerText()).toContain('4,2');

  // A dialog's messages, its reviews' plural and average, and a date the Brazilian way.
  await act(page, () => page.getByRole('link', { exact: true, name: 'Audio Interface' }).click());
  const reviews = dialog(page, 'Audio Interface').getByRole('region', { name: 'Avaliações' });
  expect(await reviews.getByRole('heading').innerText()).toMatch(/^3 avaliações, média de \d,\d$/);
  expect(await dialog(page, 'Audio Interface').getByRole('button', { name: 'Editar' }).count()).toBe(1);
  await act(page, () => page.keyboard.press('Escape'));

  await act(page, () => page.getByRole('combobox', { name: 'Idioma' }).selectOption('en'));
  expect(queryOf(page.url())['lang']).toBe('en');
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  expect(await summary(page)).toBe('37 products');
  expect(await rows(page).first().innerText()).toContain('$273.99');
});

test('each role sees what it may do: users browse, moderators edit and change prices by 20% at most, admins also delete', async ({
  page,
}) => {
  const actions = page.getByRole('link', { name: 'New product' });
  const editLinks = rows(page).getByRole('link', { name: /^Edit / });
  const deleteLinks = rows(page).getByRole('link', { name: /^Delete / });
  const switchTo = async (account: string) => {
    if (await page.getByRole('button', { name: 'Sign out' }).count())
      await act(page, () => page.getByRole('button', { name: 'Sign out' }).click());
    await act(page, () => page.getByRole('button', { name: 'Sign in' }).click());
    await signIn(page, account);
  };

  await open(page);
  // Nobody signed in may try: the actions show, and lead to signing in.
  expect(await actions.count()).toBe(1);

  await switchTo('Avery');
  expect(await page.getByRole('banner').innerText()).toContain('User');
  expect(await actions.count()).toBe(0);
  expect(await editLinks.count()).toBe(0);
  expect(await deleteLinks.count()).toBe(0);
  expect(await page.getByRole('note').first().innerText()).toContain('Changing it needs a permission you do not have.');
  // An address that opens the editor anyway shows it read-only, with nothing to save.
  await open(page, '/products/4/edit');
  const editor = dialog(page, 'Edit Audio Interface');
  expect(await editor.getByRole('note').innerText()).toContain('Changing it needs a permission you do not have.');
  expect(await editor.getByRole('button', { name: 'Save changes' }).isDisabled()).toBe(true);
  await act(page, () => page.keyboard.press('Escape'));

  await switchTo('Olivia');
  expect(await page.getByRole('banner').innerText()).toContain('Moderator');
  expect(await editLinks.count()).toBe(12);
  expect(await deleteLinks.count()).toBe(0);
  // The bulk change's rule reads the form: up to 20% applies, more does not.
  await act(page, () => page.getByRole('link', { name: 'Bulk price change' }).click());
  const wizard = dialog(page, 'Bulk price change');
  await act(page, () => wizard.getByRole('button', { name: 'Next: the rule' }).click());
  // The field commits its value when it loses focus, as a person leaves it.
  await act(page, async () => {
    await wizard.getByRole('textbox', { name: 'By' }).fill('30');
    await page.keyboard.press('Tab');
  });
  await act(page, () => wizard.getByRole('button', { name: 'Next: preview' }).click());
  expect(await wizard.getByRole('button', { name: /^Apply to/ }).isDisabled()).toBe(true);
  expect(await wizard.getByRole('note').innerText()).toContain('You change prices by 20% at most.');
  await act(page, () => wizard.getByRole('button', { name: 'Back' }).click());
  await act(page, async () => {
    await wizard.getByRole('textbox', { name: 'By' }).fill('20');
    await page.keyboard.press('Tab');
  });
  await act(page, () => wizard.getByRole('button', { name: 'Next: preview' }).click());
  expect(await wizard.getByRole('button', { name: /^Apply to/ }).isDisabled()).toBe(false);
  await act(page, () => page.keyboard.press('Escape'));
  // A deletion asked for by the address is shown, and refused.
  await open(page, '/products/4/remove');
  const question = dialog(page, /^Delete/);
  expect(await question.getByRole('note').innerText()).toContain(
    'Deleting a product needs a permission you do not have.',
  );
  expect(await question.getByRole('button', { name: 'Delete' }).isDisabled()).toBe(true);
  await act(page, () => question.getByRole('button', { name: 'Cancel' }).click());

  await switchTo('Emily');
  expect(await page.getByRole('banner').innerText()).toContain('Admin');
  expect(await deleteLinks.count()).toBe(12);
  // Every rule decided without failing: a rule that throws refuses, and would be reported.
  const failures = page.getByRole('region', { name: /Failures/ });
  expect((await failures.count()) ? await failures.innerText() : '').toBe('');
});

test('keys follow what may be done and where the flow is; `?` lists them, translated', async ({ page }) => {
  const keys = dialog(page, 'Keyboard shortcuts');
  const listed = (label: string) => keys.locator('dl > div').filter({ hasText: label }).innerText();
  const blur = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await open(page);
  // `/` goes to the search; typed in it, `n` is a letter, not a key of the app.
  await act(page, () => page.keyboard.press('/'));
  const search = page.getByRole('searchbox');
  expect(await search.evaluate((element) => element === document.activeElement)).toBe(true);
  await act(page, () => page.keyboard.type('n'));
  expect(await search.inputValue()).toBe('n');
  expect(await dialog(page, 'New product').count()).toBe(0);
  await act(page, async () => {
    await search.fill('');
    await blur();
  });

  // Someone who may only read: creating is listed, as not available now, and the key does nothing.
  await act(page, () => page.getByRole('button', { name: 'Sign in' }).click());
  await signIn(page, 'Avery');
  await act(page, () => page.keyboard.press('?'));
  expect(await listed('New product')).toContain('Not now');
  expect(await listed('Next page')).not.toContain('Not now');
  await act(page, () => page.keyboard.press('Escape'));
  await act(page, () => page.keyboard.press('n'));
  expect(await dialog(page, 'New product').count()).toBe(0);
  // A read-only editor's chart has no `save`: the key does nothing, and the browser does not save the page.
  await open(page, '/products/4/edit');
  const editor = dialog(page, 'Edit Audio Interface');
  await act(page, () => page.keyboard.press('ControlOrMeta+s'));
  expect(await editor.getByText('A product needs a title.').count()).toBe(0);
  await act(page, () => page.keyboard.press('Escape'));

  // An admin: `n` opens the editor, and the editor's key saves.
  await act(page, () => page.getByRole('button', { name: 'Sign out' }).click());
  await act(page, () => page.getByRole('button', { name: 'Sign in' }).click());
  await signIn(page);
  await act(page, () => page.keyboard.press(']'));
  expect(queryOf(page.url())['page']).toBe(2);
  await act(page, () => page.keyboard.press('['));
  expect(queryOf(page.url())['page']).toBeUndefined();
  await act(page, () => page.getByRole('link', { name: 'Edit Audio Interface' }).click());
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill('Audio Interface Mk III'));
  await act(page, () => page.keyboard.press('ControlOrMeta+s'));
  expect(await visible(editor)).toBe(false);
  expect(await rows(page).nth(1).innerText()).toContain('Audio Interface Mk III');

  // The list speaks the page's language.
  await act(page, () => arrive(page, '/products', { lang: 'pt-BR' }));
  await act(page, () => page.keyboard.press('?'));
  expect(await dialog(page, 'Atalhos de teclado').innerText()).toContain('Buscar no catálogo');
});

test('a count shows at once, before the server answers; one the server refuses is taken back', async ({ page }) => {
  await open(page, '/products', { signin: true });
  await signIn(page);
  const lamp = rows(page).filter({ hasText: 'Arc Floor Lamp' });
  const group = lamp.getByRole('group', { name: 'Stock of Arc Floor Lamp' });
  const more = group.getByRole('button', { name: 'One more in stock' });
  expect(await lamp.innerText()).toContain('58 in stock');
  await act(page, () => more.click());
  expect(await lamp.innerText()).toContain('59 in stock');

  // Every request now waits a second and is refused, retries included.
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await act(page, async () => {
    // Four steps of 250 ms.
    await lab.getByRole('slider', { name: 'Latency' }).focus();
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowRight');
  });
  await act(page, () => lab.getByRole('radio', { name: '500' }).check());
  await more.click();
  // While the write is on its way, the page is not idle: this is the one look before `idle()`.
  await expect(lamp).toContainText('60 in stock', { timeout: 900 });
  expect(await group.getAttribute('aria-busy')).toBe('true');
  await idle(page);
  expect(await lamp.innerText()).toContain('59 in stock');
  expect(await group.getAttribute('aria-busy')).toBeNull();
  expect(await page.getByRole('region', { name: /Failures/ }).innerText()).toContain('service · products.setStock');
});

test('the tabs share the session and the catalogue: a sign-in, a count and a sign-out in one reach the other', async ({
  context,
}) => {
  const one = await context.newPage();
  const other = await context.newPage();
  for (const page of [one, other])
    page.on('pageerror', (error) => {
      throw error;
    });
  await open(one);
  await open(other);
  // What another tab does arrives in its own time, twice: its message on the channel, and the
  // storage they share, which the app's reads follow. A test waits until the app has handled the
  // message and the storage has changed (the app's listener runs first), then for idle.
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

  await listen(other);
  await act(one, () => one.getByRole('button', { name: 'Sign in' }).click());
  await signIn(one);
  await heard(other);
  expect(await other.getByRole('banner').innerText()).toContain('Emily Johnson');
  // What the person may do followed too: the counts are offered.
  const lamp = (page: Page) => rows(page).filter({ hasText: 'Arc Floor Lamp' });
  expect(await lamp(other).getByRole('button', { name: 'One more in stock' }).count()).toBe(1);

  await listen(other);
  await act(one, () => lamp(one).getByRole('button', { name: 'One more in stock' }).click());
  await heard(other);
  expect(await lamp(other).innerText()).toContain('59 in stock');

  await listen(one);
  await act(other, () => other.getByRole('button', { name: 'Sign out' }).click());
  await heard(one);
  expect(await one.getByRole('banner').innerText()).not.toContain('Emily Johnson');
  expect(await lamp(one).getByRole('button', { name: 'One more in stock' }).count()).toBe(0);
});

test('flags are for the person signed in; one served another way in the lab reaches every tab, and only what reads it', async ({
  context,
}) => {
  const one = await context.newPage();
  const other = await context.newPage();
  for (const page of [one, other])
    page.on('pageerror', (error) => {
      throw error;
    });
  await open(one);
  await open(other);
  const lamp = (page: Page) => rows(page).filter({ hasText: 'Arc Floor Lamp' });
  const counts = (page: Page) => lamp(page).getByRole('button', { name: 'One more in stock' }).count();
  const deletes = (page: Page) =>
    lamp(page)
      .getByRole('link', { name: /^Delete / })
      .count();
  // Another tab hears a flag served another way when its storage says so.
  const listen = (page: Page) =>
    page.evaluate(() => {
      (window as unknown as { heard: Promise<void> }).heard = new Promise<void>((resolve) =>
        window.addEventListener('storage', () => resolve(), { once: true }),
      );
    });
  const heard = async (page: Page) => {
    await page.evaluate(() => (window as unknown as { heard: Promise<void> }).heard);
    await idle(page);
  };

  // Counting stock is rolled out to admins first.
  await act(one, () => one.getByRole('button', { name: 'Sign in' }).click());
  await signIn(one, 'Emily');
  await idle(other);
  expect(await counts(one)).toBe(1);

  await act(one, () => one.getByRole('button', { name: /Network lab/ }).click());
  const lab = one.getByRole('complementary', { name: 'Network lab' });
  await act(one, () => lab.getByRole('tab', { name: 'Flags' }).click());
  const flags = lab.getByRole('region', { name: 'Feature flags' });
  expect(await flags.getByRole('radiogroup', { name: /Stock count/ }).innerText()).toContain('For you: on');

  await listen(other);
  await act(one, () =>
    choose(flags.getByRole('radiogroup', { name: /Stock count/ }).getByRole('radio', { name: 'Nobody' })),
  );
  await heard(other);
  expect(await counts(one)).toBe(0);
  expect(await counts(other)).toBe(0);

  // A kill switch read inside acl.ts: the links go, and the dialog says why.
  expect(await deletes(other)).toBe(1);
  await listen(other);
  await act(one, () =>
    choose(flags.getByRole('radiogroup', { name: /Deletions/ }).getByRole('radio', { name: 'Paused' })),
  );
  await heard(other);
  expect(await deletes(one)).toBe(0);
  expect(await deletes(other)).toBe(0);
  await open(other, '/products/1/remove');
  const question = other.getByRole('alertdialog');
  expect(await question.getByRole('note').innerText()).toBe('Deleting products is paused for now.');
  expect(await question.getByRole('button', { name: 'Delete' }).isDisabled()).toBe(true);

  // Back to admins only, then a moderator signs in: the flags are read again, for them.
  await act(one, () =>
    choose(flags.getByRole('radiogroup', { name: /Stock count/ }).getByRole('radio', { name: 'Admins only' })),
  );
  expect(await counts(one)).toBe(1);
  await act(one, () => one.getByRole('button', { name: 'Close the network lab' }).click());
  await act(one, () => one.getByRole('button', { name: 'Sign out' }).click());
  await act(one, () => one.getByRole('button', { name: 'Sign in' }).click());
  await signIn(one, 'Olivia');
  expect(await one.getByRole('banner').innerText()).toContain('Moderator');
  expect(await counts(one)).toBe(0);
});

test('the inspector shows what a press did: the write, its optimistic change, the answer worked out from the cache, and what went stale', async ({
  page,
}) => {
  await open(page, '/products', { signin: true });
  await signIn(page);
  await act(page, () =>
    rows(page).filter({ hasText: 'Arc Floor Lamp' }).getByRole('button', { name: 'One more in stock' }).click(),
  );
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click());
  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await act(page, () => lab.getByRole('tab', { name: 'Inspector' }).click());
  const inspector = lab.getByRole('list', { name: 'What the app did, latest first' });
  // The lab reads what the pipelines carried once a second while it is open.
  await expect(inspector).toContainText(
    'products.setStock sent by Button.onPress (components/app/routes/products/components/catalogue/components/product-row/render.tsx:',
  );
  const text = await inspector.innerText();
  expect(text).toContain('shows its change to products.search and products.get now');
  expect(text).toContain('worked out again from the cache: products.search changed');
  expect(text).toContain('products.setStock done');
  expect(text).toContain('products.search, products.get, and products.inventory, by products.setStock');
  // The sign-in form's submit is its folder's handler, named for what it does.
  expect(text).toContain('handlers.signIn');
});

test('the states gallery shows every chart in each of its states; a frame holds its component in one state, with its example', async ({
  page,
}) => {
  await act(page, () => page.goto(visit('/products') + '#/states'));
  expect(await page.getByRole('heading', { level: 1 }).innerText()).toBe('States');
  expect(await page.getByRole('region').count()).toBe(CHARTS);
  const editor = page.getByRole('region', { name: 'components/app/routes/products/components/editor' });
  expect(await editor.locator('iframe').count()).toBe(11);
  expect(await editor.innerText()).toContain('Somebody else saved this product meanwhile.');

  // One frame on its own: the editor held in a conflict, the question over the form it keeps.
  await act(page, () =>
    page.goto(visit('/products') + '#/states/components%2Fapp%2Froutes%2Fproducts%2Fcomponents%2Feditor/conflict'),
  );
  const held = dialog(page, 'Edit Arc Floor Lamp');
  expect(await held.getByRole('alert').innerText()).toContain('Somebody else changed this product');
  expect(await held.getByRole('textbox', { name: 'Title' }).inputValue()).toBe('Arc Floor Lamp');
  // Nothing moves: the chart is not started.
  await act(page, () => held.getByRole('button', { name: 'Save mine anyway' }).click());
  expect(await held.getByRole('alert').count()).toBe(1);

  // A question shown with the dialog it asks about sits above it, though the page added it first.
  await act(page, () =>
    page.goto(
      visit('/products') + '#/states/components%2Fapp%2Froutes%2Fproducts%2Fcomponents%2Feditor/confirmingDiscard',
    ),
  );
  // (A frame is a picture: the gallery lets no pointer reach it.)
  const layers = await page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.querySelectorAll('.react-aria-ModalOverlay')).map((overlay) => [
        overlay.querySelector('[role=alertdialog]') ? 'question' : 'dialog',
        Number(getComputedStyle(overlay).zIndex),
      ]),
    ),
  );
  expect(layers['question']).toBeGreaterThan(layers['dialog']!);
});
