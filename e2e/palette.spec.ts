// The command palette, in the memory world. Every step is: act, wait for the framework to say it is
// idle, then look once. The palette waits a quarter second after the last key before it searches;
// that pause is a timer the framework does not see, so the clock is advanced past it.

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
const dialog = (page: Page, name: RegExp | string) =>
  page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }));
const palette = (page: Page) => dialog(page, 'Commands');
const items = (commands: Locator) => commands.getByRole('menuitem');
const products = (commands: Locator) => commands.locator('[itemtype="https://schema.org/Product"]').allInnerTexts();

async function signIn(page: Page, account: string) {
  const form = dialog(page, 'Sign in');
  await act(page, () => form.getByRole('button', { name: new RegExp(`^${account},`) }).click());
  await act(page, () => form.getByRole('button', { name: 'Sign in' }).click());
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('the header buttons describe the keys that open them', async ({ page }) => {
  await open(page);
  const header = page.getByRole('banner');
  const paletteButton = header.getByRole('button', { name: 'Command palette' });
  const paletteKey = await paletteButton.locator('kbd').innerText();
  expect(paletteKey).toMatch(/^(⌘K|Ctrl K)$/);
  await expect(paletteButton).toHaveAccessibleDescription(paletteKey);
  await expect(header.getByRole('button', { name: 'Keyboard shortcuts' })).toHaveAccessibleDescription('?');
  await expect(header.getByRole('button', { name: 'Take the tour' })).toHaveAccessibleDescription('T');
});

test('the key opens the palette, which lists what can be done here and searches the products', async ({ page }) => {
  await page.clock.install();
  await open(page);
  expect(await palette(page).count()).toBe(0);

  await act(page, () => page.keyboard.press('ControlOrMeta+k'));
  const commands = palette(page);
  expect(await commands.count()).toBe(1);
  expect(await items(commands).filter({ hasText: 'New product' }).count()).toBe(1);

  await act(page, () => commands.getByRole('searchbox').pressSequentially('lamp'));
  await page.clock.runFor(300);
  await act(page, async () => undefined);
  expect(await products(commands)).toEqual(['Arc Floor Lamp', 'Clamp Lamp', 'Task Lamp']);

  // The menu focuses its first command when the text changes: Enter runs Arc Floor Lamp.
  await act(page, () => page.keyboard.press('Enter'));
  expect(page.url()).toContain('view=22');
  expect(await palette(page).count()).toBe(0);
});

test('a command the permissions refuse is listed and not now', async ({ page }) => {
  await open(page, '#/products?signin=1');
  await signIn(page, 'Avery');
  await act(page, () => page.keyboard.press('ControlOrMeta+k'));
  const create = items(palette(page)).filter({ hasText: 'New product' });
  expect(await create.getAttribute('aria-disabled')).toBe('true');
});

test('over the editor, Save is listed; the palette names its pieces as schema.org does', async ({ page }) => {
  await open(page, '#/products?signin=1');
  await signIn(page, 'Emily');
  await open(page, '#/products?edit=22');
  await act(page, () => page.keyboard.press('ControlOrMeta+k'));
  expect(await items(palette(page)).filter({ hasText: 'Save the product' }).count()).toBe(1);
  expect(await page.evaluate(checkMicrodata, vocabulary)).toEqual([]);
});
