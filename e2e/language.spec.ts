import { expect, type Page, test } from '@playwright/test';

const idle = (page: Page) => page.evaluate(() => window.__framework.idle());
const language = (page: Page) => page.getByRole('combobox', { name: /^(Language|Idioma)$/ });
const translations = /\/pt-BR(?:-[^/]+\.js|\.json(?:\?.*)?)$/;

for (const skin of ['default', 'broadsheet', 'blueprint']) {
  for (const locale of ['en', 'pt-BR']) {
    test(`the native language select keeps its identity, focus and history in ${skin}, starting in ${locale}`, async ({
      page,
    }) => {
      await page.goto(`./?world=memory&skin=${skin}&lang=${locale}#/products`);
      await idle(page);
      const select = language(page);
      const node = await select.elementHandle();
      const before = page.url();
      expect(await select.inputValue()).toBe(locale);
      expect(await select.locator('option').allTextContents()).toEqual(['English', 'Português (Brasil)']);
      expect(await select.locator('option[value="pt-BR"]').getAttribute('lang')).toBe('pt-BR');

      // Tab reaches the control; option selection itself belongs to the platform.
      await select.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      expect(await select.evaluate((element) => element === document.activeElement)).toBe(true);

      const next = locale === 'en' ? 'pt-BR' : 'en';
      await select.selectOption(next);
      await idle(page);
      expect(await select.inputValue()).toBe(next);
      expect(await select.getAttribute('aria-label')).toBe(next === 'en' ? 'Language' : 'Idioma');
      expect(await select.evaluate((element, original) => element === original, node)).toBe(true);
      expect(await select.evaluate((element) => element === document.activeElement)).toBe(true);
      expect(await page.locator('html').getAttribute('lang')).toBe(next);
      expect(await page.locator('[itemtype="https://schema.org/Language"] meta').getAttribute('content')).toBe(next);
      expect(new URL(page.url()).searchParams.get('lang')).toBe(next);
      expect(new URL(page.url()).hash).toBe(new URL(before).hash);

      // Locale changes replace the current entry; navigating away and back keeps that choice.
      await page.getByRole('link', { exact: true, name: next === 'en' ? 'Report' : 'Relatório' }).click();
      await idle(page);
      await page.goBack();
      await idle(page);
      expect(await select.inputValue()).toBe(next);
      expect(new URL(page.url()).hash).toBe(new URL(before).hash);
      await page.goForward();
      await idle(page);
      expect(await select.inputValue()).toBe(next);
      await node?.dispose();
    });
  }
}

test('a delayed Portuguese selection followed by English keeps the last choice', async ({ page }) => {
  await page.goto('./?world=memory&lang=en#/products');
  await idle(page);
  let release!: () => void;
  let requested!: () => void;

  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });

  // Context interception also works with Firefox builds predating page-level service-worker bypass.
  await page.context().route(translations, async (route) => {
    requested();
    await held;
    await route.continue();
  });

  await language(page).selectOption('pt-BR');
  await started;
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  await language(page).selectOption('en');
  release();
  await idle(page);
  expect(await language(page).inputValue()).toBe('en');
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
});

test('unavailable translations keep the language options and source label usable', async ({ page }) => {
  await page.goto('./?world=memory&lang=en#/products');
  await idle(page);
  await page.context().route(translations, (route) => route.abort());
  await language(page).selectOption('pt-BR');
  await idle(page);
  expect(await language(page).inputValue()).toBe('pt-BR');
  expect(await language(page).getAttribute('aria-label')).toBe('Language');
  expect(await language(page).locator('option').allTextContents()).toEqual(['English', 'Português (Brasil)']);
  expect(await page.locator('html').getAttribute('lang')).toBe('pt-BR');
  await language(page).selectOption('en');
  await idle(page);
  expect(await language(page).inputValue()).toBe('en');
});
