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

  await act(page, () => page.getByRole('combobox', { name: 'Skin' }).selectOption('broadsheet'));
  expect(await page.evaluate(() => document.documentElement.dataset['skin'])).toBe('broadsheet');
  expect(new URL(page.url()).searchParams.get('skin')).toBe('broadsheet');
  expect(await look()).not.toBe(before.look);
  expect(await markup()).toBe(before.markup);

  // The address keeps it: a reload wears it again.
  await act(page, () => page.reload());
  expect(await page.evaluate(() => document.documentElement.dataset['skin'])).toBe('broadsheet');
  expect(await markup()).toBe(before.markup);
});

for (const initial of ['default', 'broadsheet', 'blueprint']) {
  for (const locale of ['en', 'pt-BR']) {
    test(`the native skin select keeps its choice, identity and focus from ${initial}, ${locale}`, async ({ page }) => {
      await act(page, () => page.goto(`./?world=memory&skin=${initial}&lang=${locale}#/products?q=lamp`));
      const select = page.getByRole('combobox', { name: locale === 'en' ? 'Skin' : 'Visual' });
      const node = await select.elementHandle();
      const history = await page.evaluate(() => window.history.length);
      const hash = new URL(page.url()).hash;
      expect(await select.inputValue()).toBe(initial);
      expect(await select.locator('option').allTextContents()).toEqual(
        locale === 'en' ? ['Default', 'Broadsheet', 'Blueprint'] : ['Padrão', 'Jornal', 'Planta'],
      );

      // Tab reaches the field; choosing an option belongs to the platform.
      await select.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      expect(await select.evaluate((element) => element === document.activeElement)).toBe(true);

      for (const next of ['broadsheet', 'blueprint', 'default']) {
        await act(page, () => select.selectOption(next));
        expect(await select.inputValue()).toBe(next);
        expect(await page.locator('html').getAttribute('data-skin')).toBe(next);
        expect(new URL(page.url()).searchParams.get('skin')).toBe(next === 'default' ? null : next);
        expect(new URL(page.url()).searchParams.get('world')).toBe('memory');
        expect(new URL(page.url()).hash).toBe(hash);
        expect(await page.evaluate(() => window.history.length)).toBe(history);
        expect(await select.evaluate((element, original) => element === original, node)).toBe(true);
        expect(await select.evaluate((element) => element === document.activeElement)).toBe(true);
      }

      const nextLocale = locale === 'en' ? 'pt-BR' : 'en';
      await act(page, () =>
        page.getByRole('combobox', { name: locale === 'en' ? 'Language' : 'Idioma' }).selectOption(nextLocale),
      );
      const translated = page.getByRole('combobox', { name: nextLocale === 'en' ? 'Skin' : 'Visual' });
      expect(await translated.locator('option').allTextContents()).toEqual(
        nextLocale === 'en' ? ['Default', 'Broadsheet', 'Blueprint'] : ['Padrão', 'Jornal', 'Planta'],
      );
      expect(await translated.inputValue()).toBe('default');
      expect(await translated.evaluate((element, original) => element === original, node)).toBe(true);

      await act(page, () =>
        page.getByRole('link', { exact: true, name: nextLocale === 'en' ? 'Report' : 'Relatório' }).click(),
      );
      await act(page, () => page.goBack());
      expect(new URL(page.url()).hash).toBe(hash);
      expect(await translated.inputValue()).toBe('default');
      await act(page, () => page.goForward());
      expect(await translated.inputValue()).toBe('default');
      await node?.dispose();
    });
  }
}

// The existing switch owns its initial selection; external skin changes do not synchronize it.
test('an outside skin change and history keep the initial selector contract', async ({ page }) => {
  await act(page, () => page.goto('./?world=memory#/products'));
  const select = page.getByRole('combobox', { name: 'Skin' });
  const node = await select.elementHandle();
  await select.focus();
  await act(page, () =>
    page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('skin', 'blueprint');
      window.history.pushState(window.history.state, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }),
  );
  expect(await page.locator('html').getAttribute('data-skin')).toBe('blueprint');
  expect(await select.inputValue()).toBe('default');
  expect(await select.evaluate((element, original) => element === original, node)).toBe(true);
  expect(await select.evaluate((element) => element === document.activeElement)).toBe(true);
  await act(page, () => page.goBack());
  expect(await page.locator('html').getAttribute('data-skin')).toBe('default');
  expect(await select.inputValue()).toBe('default');
  await act(page, () => page.goForward());
  expect(await page.locator('html').getAttribute('data-skin')).toBe('blueprint');
  expect(await select.inputValue()).toBe('default');
  await node?.dispose();
});
