import { expect, type Page, test } from '@playwright/test';

import { arrive, visit } from '../perf/address.mjs';

const idle = (page: Page) => page.evaluate(() => window.__framework.idle());

async function headings(page: Page) {
  const dialogs = page.locator('.react-aria-Modal').locator('[role="dialog"], [role="alertdialog"]');

  expect(await dialogs.count()).toBeGreaterThan(0);

  for (const dialog of await dialogs.all()) {
    const heading = dialog.locator('h2').first();

    expect(await heading.count()).toBe(1);
    expect(await dialog.getAttribute('aria-label')).toBe((await heading.textContent())?.trim());
    expect(await dialog.getAttribute('aria-labelledby')).toBeNull();
    expect(await heading.getAttribute('slot')).toBeNull();
    expect(await heading.getAttribute('data-rac')).toBeNull();
  }
}

for (const skin of ['default', 'broadsheet', 'blueprint']) {
  for (const locale of ['en', 'pt-BR']) {
    const settings = { lang: locale, skin };

    test(`dialog headings name stacked sign-in, editor and discard in ${skin}, ${locale}`, async ({ page }) => {
      await arrive(page, '/products/4/edit', settings);
      await idle(page);
      const signIn = page.getByRole('dialog', { name: locale === 'en' ? 'Sign in' : 'Entrar' });
      const node = await signIn.elementHandle();
      await headings(page);

      await page
        .locator('[itemtype="https://schema.org/Language"] select')
        .selectOption(locale === 'en' ? 'pt-BR' : 'en', { force: true });
      await idle(page);
      const translated = page.getByRole('dialog', { name: locale === 'en' ? 'Entrar' : 'Sign in' });
      expect(await translated.evaluate((element, original) => element === original, node)).toBe(true);
      await headings(page);
      await page.locator('[itemtype="https://schema.org/Language"] select').selectOption(locale, { force: true });
      await idle(page);

      await signIn.getByRole('button', { name: /^Emily,/ }).click();
      await idle(page);
      await signIn.getByRole('button', { exact: true, name: locale === 'en' ? 'Sign in' : 'Entrar' }).click();
      await idle(page);
      const editor = page.getByRole('dialog', {
        exact: true,
        name: locale === 'en' ? 'Edit Audio Interface' : 'Editar Audio Interface',
      });
      await headings(page);
      await editor.getByRole('textbox', { exact: true, name: locale === 'en' ? 'Title' : 'Título' }).fill('Draft');
      await page.keyboard.press('Escape');
      await idle(page);
      expect(await page.getByRole('alertdialog').getAttribute('aria-label')).toBe(
        locale === 'en' ? 'Discard your changes?' : 'Descartar suas alterações?',
      );
      await headings(page);

      await arrive(page, '/orders/12', settings);
      await idle(page);
      await headings(page);
      expect(await page.locator('h2 [itemprop="orderNumber"]').textContent()).toBe(
        locale === 'en' ? 'Order 12' : 'Pedido 12',
      );
      await arrive(page, '/orders/999', settings);
      await idle(page);
      await headings(page);
      expect(
        await page
          .getByRole('alertdialog', {
            name: locale === 'en' ? 'The order could not be read' : 'Não foi possível ler o pedido',
          })
          .isVisible(),
      ).toBe(true);
    });

    test(`dialog heading gallery examples retain names in ${skin}, ${locale}`, async ({ page }) => {
      for (const [folder, state] of [
        ['app/routes/products/components/editor', 'loading'],
        ['app/routes/products/components/editor', 'unavailable'],
        ['app/routes/products/routes/:id/routes/remove', 'loading'],
        ['app/routes/products/routes/:id/routes/remove', 'confirming'],
        ['app/routes/products/routes/bulk', 'confirmingLargeChange'],
        ['app/routes/products/routes/bulk', 'applying'],
        ['app/routes/products/routes/bulk', 'summary'],
        ['session', 'signingIn'],
      ]) {
        await page.goto(
          `${visit('/products', settings)}#/states/${encodeURIComponent(`components/${folder}`)}/${state}`,
        );
        await idle(page);
        await headings(page);
      }
    });

    test(`detail content and error headings keep microdata in ${skin}, ${locale}`, async ({ page }) => {
      await arrive(page, '/products', settings);
      await idle(page);
      await page.keyboard.press('?');
      await idle(page);
      await headings(page);
      await arrive(page, '/products/4', settings);
      await idle(page);
      await headings(page);
      expect(await page.locator('h2 [itemprop="name"]').textContent()).toBe('Audio Interface');
      await arrive(page, '/products/999', settings);
      await idle(page);
      await headings(page);
      expect(
        await page
          .getByRole('alertdialog', {
            name: locale === 'en' ? 'The product could not be read' : 'Não foi possível ler o produto',
          })
          .isVisible(),
      ).toBe(true);
    });
  }
}
