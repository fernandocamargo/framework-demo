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

// A list's sheet is its own file, loaded when the list first shows in a skin. After the page's skin
// changed, the first tab shown waits for it: the tab alone, with the page and the lab around it as
// they were, and never as a list with nothing in it.
test('the API client tab waits alone for its sheet after the skin changed', async ({ page }) => {
  await page.goto('./?world=memory#/products');
  await page.evaluate(() => window.__framework.idle());
  await page.getByRole('button', { name: /Skin/ }).click();
  await page.getByRole('option', { name: /Broadsheet/ }).click();
  await page.evaluate(() => window.__framework.idle());

  // Every script asked for from here on is held until the test has looked at the page.
  const held: (() => void)[] = [];
  let holding = true;
  let asked = () => {};
  const sheet = new Promise<void>((resolve) => (asked = resolve));

  await page.route('**/*.js', async (route) => {
    if (holding)
      await new Promise<void>((send) => {
        held.push(send);
        asked();
      });
    await route.continue();
  });

  const lab = page.getByRole('complementary', { name: 'Network lab' });
  await page.getByRole('button', { name: /Network lab/ }).click();
  await sheet;

  // Two frames: the commit that asked for the sheet has painted.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  expect(await page.getByRole('list', { name: 'Products' }).isVisible()).toBe(true);
  expect(await lab.isVisible()).toBe(true);
  expect(await lab.getByRole('tab', { name: 'API client' }).getAttribute('aria-selected')).toBe('true');
  expect(await lab.locator('ol[aria-busy="true"]').count()).toBe(1);
  expect(await lab.locator('ol > li').count()).toBe(0);

  holding = false;
  for (const send of held.splice(0)) send();
  await page.evaluate(() => window.__framework.idle());
  expect(await lab.locator('ol[aria-busy="true"]').count()).toBe(0);
  expect(await lab.locator('ol > li[itemscope]').count()).toBeGreaterThan(0);
});

// The lab loads both lists' files when it opens, so the Inspector tab asks for nothing more when it
// shows: it shows its entries at once, never waiting and never empty.
test('the Inspector tab shows at once, its files loaded with the lab', async ({ page }) => {
  await page.goto('./?world=memory#/products');
  await page.evaluate(() => window.__framework.idle());
  await page.getByRole('button', { name: /Skin/ }).click();
  await page.getByRole('option', { name: /Broadsheet/ }).click();
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
