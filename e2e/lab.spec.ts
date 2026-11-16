import { expect, test } from '@playwright/test';

test('the lab shows existing activity on each first frame and keeps it across tab and panel closes', async ({
  page,
}) => {
  await page.goto('./?world=memory#/products');
  await page.evaluate(() => window.__framework.idle());

  await page.getByRole('button', { name: /Network lab/ }).click();
  await page.evaluate(() => window.__framework.idle());

  const lab = page.getByRole('complementary', { name: 'Network lab' });
  const network = lab.getByRole('list', { name: "The API client's latest requests" });
  const first = await network.locator('li[itemscope]').count();

  expect(first).toBeGreaterThan(0);
  expect(await network.innerText()).not.toContain('No request yet.');

  await lab.getByRole('tab', { name: 'Inspector' }).click();
  await page.evaluate(() => window.__framework.idle());

  const inspector = lab.getByRole('list', { name: 'What the app did, latest first' });

  expect(await inspector.locator('li[itemscope]').count()).toBeGreaterThan(0);
  expect(await inspector.innerText()).not.toContain('Nothing yet.');

  await lab.getByRole('tab', { name: 'API client' }).click();
  await page.evaluate(() => window.__framework.idle());

  expect(await network.locator('li[itemscope]').count()).toBeGreaterThanOrEqual(first);

  await lab.getByRole('button', { name: 'Close the network lab' }).click();
  await page.evaluate(() => window.__framework.idle());
  await page.getByRole('button', { name: /Network lab/ }).click();
  await page.evaluate(() => window.__framework.idle());

  expect(await network.locator('li[itemscope]').count()).toBeGreaterThanOrEqual(first);
});

test('the gallery lists the two child charts under their own folders', async ({ page }) => {
  await page.goto('./?world=memory#/states');
  await page.evaluate(() => window.__framework.idle());

  expect(await page.getByRole('region', { name: 'components/lab/components/network' }).locator('iframe').count()).toBe(
    1,
  );
  expect(await page.getByRole('region', { name: 'components/lab/components/tracked' }).locator('iframe').count()).toBe(
    1,
  );
  expect(await page.getByRole('region', { exact: true, name: 'components/lab' }).locator('iframe').count()).toBe(2);
});

// After the page's skin changed, the lab's first list may still need its sheet when the lab opens,
// or may have it already, as the page's loading goes. Either way it is never a list with nothing in
// it: it waits, marked busy, or it shows its entries; and once the page is at rest it shows them.
test('the API client tab never shows an empty list after the skin changed', async ({ page }) => {
  await page.goto('./?world=memory#/products');
  await page.evaluate(() => window.__framework.idle());
  await page.getByRole('combobox', { name: 'Skin' }).selectOption('broadsheet');
  await page.evaluate(() => window.__framework.idle());

  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await page.getByRole('button', { name: /Network lab/ }).click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  expect(await page.getByRole('list', { name: 'Products' }).isVisible()).toBe(true);
  expect(await lab.getByRole('tab', { name: 'API client' }).getAttribute('aria-selected')).toBe('true');
  const busy = await lab.locator('ol[aria-busy="true"]').count();
  const entries = await lab.locator('ol > li').count();
  // Waiting with nothing in it yet, or not waiting and with its entries: never empty and at rest.
  expect(busy === 1 ? entries === 0 : entries > 0).toBe(true);

  await page.evaluate(() => window.__framework.idle());
  expect(await lab.locator('ol[aria-busy="true"]').count()).toBe(0);
  expect(await lab.locator('ol > li[itemscope]').count()).toBeGreaterThan(0);
});

// The lab loads both lists' files when it opens, so the Inspector tab asks for nothing more when it
// shows: it shows its entries at once, never waiting and never empty.
test('the Inspector tab shows at once, its files loaded with the lab', async ({ page }) => {
  await page.goto('./?world=memory#/products');
  await page.evaluate(() => window.__framework.idle());
  await page.getByRole('combobox', { name: 'Skin' }).selectOption('broadsheet');
  await page.evaluate(() => window.__framework.idle());

  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await page.getByRole('button', { name: /Network lab/ }).click();
  await page.evaluate(() => window.__framework.idle());

  const asked: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.js')) asked.push(request.url());
  });
  await page.evaluate(() => window.__framework.idle());
  await lab.getByRole('tab', { name: 'Inspector' }).click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  expect(asked).toEqual([]);
  expect(await lab.getByRole('tab', { name: 'Inspector' }).getAttribute('aria-selected')).toBe('true');
  expect(await lab.locator('ol[aria-busy="true"]').count()).toBe(0);
  expect(await lab.locator('ol > li').count()).toBeGreaterThan(0);
});

for (const skin of ['default', 'broadsheet', 'blueprint']) {
  for (const locale of ['en', 'pt-BR']) {
    test(`native lab choices keep values, names and focus in ${skin}, ${locale}`, async ({ page }) => {
      await page.goto(`./?world=memory&skin=${skin}&lang=${locale}#/products`);
      await page.evaluate(() => window.__framework.idle());
      const title = locale === 'en' ? 'Network lab' : 'Laboratório de rede';
      await page.getByRole('button', { name: title }).click();
      await page.evaluate(() => window.__framework.idle());
      const lab = page.getByRole('complementary', { name: title });

      const force = lab.getByRole('group', {
        name: locale === 'en' ? 'Every request answers' : 'Toda requisição responde',
      });

      const lifetime = lab.getByRole('group', {
        name: locale === 'en' ? /Access token lifetime/ : /Validade do token de acesso/,
      });

      const forceNode = await force.elementHandle();
      const lifetimeNode = await lifetime.elementHandle();
      const ok = locale === 'en' ? 'As it should' : 'Como deveria';
      const initialAddress = page.url();
      expect(await force.evaluate((element) => element.tagName)).toBe('FIELDSET');
      expect(await lifetime.evaluate((element) => element.tagName)).toBe('FIELDSET');
      expect(await force.getByRole('radio', { checked: true }).inputValue()).toBe('0');
      expect(await lifetime.getByRole('radio', { checked: true }).inputValue()).toBe('1');
      expect(await force.getByRole('radio').first().getAttribute('name')).not.toBe(
        await lifetime.getByRole('radio').first().getAttribute('name'),
      );

      for (const [group, choices] of [
        [force, ['500', '429', ok]],
        [lifetime, ['30 min', '1 min', '5 min']],
      ] as const) {
        for (const name of choices) {
          const radio = group.getByRole('radio', { exact: true, name });
          const node = await radio.elementHandle();
          await radio.focus();
          await radio.check();
          await page.evaluate(() => window.__framework.idle());
          expect(await radio.isChecked()).toBe(true);
          expect(await group.getByRole('radio', { checked: true }).count()).toBe(1);
          expect(await radio.evaluate((element) => element === document.activeElement)).toBe(true);
          expect(await radio.evaluate((element, original) => element === original, node)).toBe(true);
          expect(page.url()).toBe(initialAddress);
        }
      }

      await page
        .getByRole('combobox', { name: locale === 'en' ? 'Language' : 'Idioma' })
        .selectOption(locale === 'en' ? 'pt-BR' : 'en');
      await page.evaluate(() => window.__framework.idle());

      const translated = page.getByRole('complementary', {
        name: locale === 'en' ? 'Laboratório de rede' : 'Network lab',
      });

      const translatedForce = translated.getByRole('group', {
        name: locale === 'en' ? 'Toda requisição responde' : 'Every request answers',
      });

      const translatedLifetime = translated.getByRole('group', {
        name: locale === 'en' ? /Validade do token de acesso/ : /Access token lifetime/,
      });

      expect(await translatedForce.evaluate((element, original) => element === original, forceNode)).toBe(true);
      expect(await translatedLifetime.evaluate((element, original) => element === original, lifetimeNode)).toBe(true);
      expect(await translatedForce.getByRole('radio', { checked: true }).inputValue()).toBe('0');
      expect(await translatedLifetime.getByRole('radio', { checked: true }).inputValue()).toBe('5');

      await translated
        .getByRole('button', {
          name: locale === 'en' ? 'Fechar o laboratório de rede' : 'Close the network lab',
        })
        .click();
      await page.evaluate(() => window.__framework.idle());
      await page.getByRole('button', { name: locale === 'en' ? 'Laboratório de rede' : 'Network lab' }).click();
      await page.evaluate(() => window.__framework.idle());
      expect(await translated.getByRole('radio', { name: '5 min' }).isChecked()).toBe(true);
    });
  }
}
