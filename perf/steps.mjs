// The flow perf/cycles.mjs measures, in the memory world: what a person does in one visit. Each
// step acts, waits for `window.__framework.idle()`, then checks the page once. A check that fails
// right after `idle()` is a miss: the signal resolved before the page was done.

import { readdirSync } from 'node:fs';

/** Every component folder with a chart: what the states gallery must show, one region each. */
const CHARTS = readdirSync(new URL('../src/components', import.meta.url), { recursive: true }).filter(
  (file) => String(file).split(/[\\/]/).pop() === 'state.ts',
).length;
const dialog = (page, name) => page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }));
/** The list's own items, not those of the lists inside them (a row's commands). */
const rows = (page) => page.getByRole('list', { name: 'Products' }).locator(':scope > li');
const shown = async (locator) => (await locator.count()) > 0 && (await locator.first().isVisible());
const status = (page) => page.getByRole('status').first().innerText();
const lab = (page) => page.getByRole('complementary', { name: 'Network lab' });
const latency = (page) => lab(page).getByRole('slider', { name: 'Latency' });

/** In the page: serves the flags these ways, as another tab of the world would. */
const serve = (ways) => {
  window.localStorage.setItem('memory:flags', JSON.stringify(ways));
  window.dispatchEvent(new StorageEvent('storage', { key: 'memory:flags', storageArea: window.localStorage }));
};

export const STEPS = [
  {
    act: (page, base) => page.goto(`${base}/?world=memory#/products`),
    check: async (page) => (await rows(page).count()) === 12,
    name: 'open the catalogue',
  },
  {
    act: async (page) => {
      await page.getByRole('searchbox', { name: 'Search products' }).fill('lamp');
      await page.keyboard.press('Enter');
    },
    check: async (page) => (await rows(page).count()) === 3,
    name: 'search for "lamp"',
  },
  {
    act: async (page) => {
      await page.getByRole('button', { name: /Sort/ }).click();
      await page.getByRole('option', { name: 'Price, high to low' }).click();
    },
    check: async (page) => page.url().includes('sort=price&order=desc'),
    name: 'sort by price, high to low',
  },
  {
    act: (page) => page.getByRole('button', { name: 'Clear the search' }).click(),
    check: async (page) => (await rows(page).count()) === 12,
    name: 'clear the search',
  },
  {
    act: async (page) => {
      await page.getByRole('button', { name: /Category/ }).click();
      await page.getByRole('option', { name: 'Desks' }).click();
    },
    check: async (page) => (await status(page)).includes('in Desks'),
    name: 'choose a category',
  },
  {
    act: async (page) => {
      await page.getByRole('button', { name: /Category/ }).click();
      await page.getByRole('option', { name: 'All categories' }).click();
      await page.getByRole('link', { name: 'Next' }).click();
    },
    check: async (page) => page.url().includes('page=2'),
    name: 'all categories, page 2',
  },
  {
    act: (page) => page.getByRole('link', { name: 'Previous' }).click(),
    check: async (page) => !page.url().includes('page='),
    name: 'back to page 1',
  },
  {
    act: async (page) => {
      await page.getByRole('button', { name: /Sort/ }).click();
      await page.getByRole('option', { name: 'Title, A to Z' }).click();
    },
    check: async (page) => !page.url().includes('sort='),
    name: 'sort by title again',
  },
  {
    act: (page) => page.getByRole('link', { exact: true, name: 'Audio Interface' }).click(),
    check: async (page) =>
      (await dialog(page, 'Audio Interface').getByRole('region', { name: 'Reviews' }).getByRole('listitem').count()) ===
      3,
    name: 'open a product',
  },
  {
    act: (page) => page.keyboard.press('Escape'),
    check: async (page) => !page.url().includes('view='),
    name: 'close the product',
  },
  {
    act: (page) => page.getByRole('link', { name: 'Edit Audio Interface' }).click(),
    check: (page) => shown(dialog(page, 'Sign in')),
    name: 'edit, which asks to sign in',
  },
  {
    act: (page) =>
      dialog(page, 'Sign in')
        .getByRole('button', { name: /^Emily,/ })
        .click(),
    check: async (page) =>
      (await dialog(page, 'Sign in').getByRole('textbox', { name: 'Username' }).inputValue()) !== '',
    name: 'fill the demo account in',
  },
  {
    act: (page) => dialog(page, 'Sign in').getByRole('button', { name: 'Sign in' }).click(),
    check: (page) => shown(dialog(page, 'Edit Audio Interface')),
    name: 'sign in',
  },
  {
    act: async (page) => {
      const title = dialog(page, 'Edit Audio Interface').getByRole('textbox', { name: 'Title' });
      // The caret at the end, set directly: the End key does not move it in WebKit on a Mac.
      await title.focus();
      await title.evaluate((field) => field.setSelectionRange(field.value.length, field.value.length));
      await title.pressSequentially(' Mk II');
    },
    check: async (page) =>
      (await dialog(page, /Edit Audio Interface/)
        .getByRole('textbox', { name: 'Title' })
        .inputValue()) === 'Audio Interface Mk II',
    name: 'type six keys in the title',
  },
  {
    act: (page) =>
      dialog(page, /Edit Audio Interface/)
        .getByRole('button', { name: 'Save changes' })
        .click(),
    check: async (page) =>
      (await rows(page).filter({ hasText: 'Audio Interface Mk II' }).filter({ hasText: 'Edited' }).count()) === 1,
    name: 'save',
  },
  {
    act: (page) => page.getByRole('link', { name: 'Bulk price change' }).click(),
    check: (page) => shown(dialog(page, 'Bulk price change')),
    name: 'open the bulk price change',
  },
  {
    act: async (page) => {
      await dialog(page, 'Bulk price change')
        .getByRole('button', { name: /Category/ })
        .click();
      await page.getByRole('option', { name: 'Keyboards' }).click();
    },
    check: async (page) => (await dialog(page, 'Bulk price change').innerText()).includes('9 of 9 products selected'),
    name: 'choose the keyboards',
  },
  {
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Next: the rule' }).click(),
    check: (page) => shown(dialog(page, 'Bulk price change').getByRole('textbox', { name: 'By' })),
    name: 'next: the rule',
  },
  {
    act: (page) => dialog(page, 'Bulk price change').getByRole('textbox', { name: 'By' }).fill('15'),
    check: async (page) =>
      (await dialog(page, 'Bulk price change').getByRole('textbox', { name: 'By' }).inputValue()).startsWith('15'),
    name: 'type 15 as the percentage',
  },
  {
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Next: preview' }).click(),
    check: async (page) => (await dialog(page, 'Bulk price change').getByRole('row').count()) === 10,
    name: 'next: preview',
  },
  {
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Apply to 9' }).click(),
    check: async (page) => (await dialog(page, 'Bulk price change').innerText()).includes('9 prices changed.'),
    name: 'apply to the nine',
  },
  {
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Done' }).click(),
    check: async (page) => !page.url().includes('bulk='),
    name: 'done',
  },
  // A flag served another way, as another tab (or GrowthBook's dashboard) would: the provider says
  // its flags changed, and only the components that read that flag render again.
  {
    act: (page) => page.evaluate(serve, { stockCount: 'nobody' }),
    check: async (page) =>
      (await rows(page).count()) === 12 &&
      (await page.getByRole('button', { name: 'One more in stock' }).count()) === 0,
    name: 'stock count served to nobody',
  },
  {
    act: (page) => page.evaluate(serve, { deletions: 'off', stockCount: 'nobody' }),
    check: async (page) =>
      (await rows(page).count()) === 12 &&
      (await rows(page)
        .getByRole('link', { name: /^Delete / })
        .count()) === 0,
    name: 'deletions paused',
  },
  {
    act: (page) => page.evaluate(serve, {}),
    check: async (page) =>
      (await page.getByRole('button', { name: 'One more in stock' }).count()) === 12 &&
      (await rows(page)
        .getByRole('link', { name: /^Delete / })
        .count()) === 12,
    name: 'both served as before',
  },
  {
    act: (page) => page.getByRole('button', { name: /Network lab/ }).click(),
    check: (page) => shown(page.getByRole('complementary', { name: 'Network lab' })),
    name: 'open the network lab',
  },
  {
    act: async (page) => {
      await page.getByRole('button', { name: 'Language' }).click();
      await page.getByRole('option', { name: 'Português (Brasil)' }).click();
    },
    check: async (page) => (await status(page)) === '37 produtos',
    name: 'switch to Português (Brasil)',
  },
  {
    act: async (page) => {
      await page.getByRole('button', { name: 'Idioma' }).click();
      await page.getByRole('option', { name: 'English' }).click();
    },
    check: async (page) => (await status(page)) === '37 products',
    name: 'back to English',
  },
  {
    act: (page) => page.getByRole('button', { name: 'Sign out' }).click(),
    check: (page) => shown(page.getByRole('button', { name: 'Sign in' })),
    name: 'sign out',
  },
  // Beyond the visit: what the 29 steps above do not reach. They are counted apart (`further`), so
  // the visit's totals stay comparable from one change to the next.
  {
    act: (page) => page.waitForTimeout(2200),
    check: (page) => shown(lab(page)),
    further: true,
    name: 'two seconds with the lab open',
  },
  {
    // One focus, two keys: the slider keeps the focus as its setting changes.
    act: async (page) => {
      await latency(page).focus();
      for (let step = 0; step < 2; step++) {
        await page.keyboard.press('ArrowRight');
        await page.evaluate(() => window.__framework.idle());
      }
    },
    check: async (page) => (await lab(page).innerText()).includes('500 ms'),
    further: true,
    name: 'slow the network down: 500 ms',
  },
  {
    act: async (page) => {
      await page.getByRole('searchbox', { name: 'Search products' }).fill('desk');
      await page.keyboard.press('Enter');
    },
    check: async (page) => (await status(page)).includes('desk') && (await rows(page).count()) > 0,
    further: true,
    name: 'slow: search for "desk"',
  },
  {
    act: (page) => rows(page).first().getByRole('link').first().click(),
    check: async (page) =>
      (await page.getByRole('dialog').getByRole('region', { name: 'Reviews' }).getByRole('listitem').count()) > 0,
    further: true,
    name: 'slow: open a product',
  },
  {
    act: (page) => page.keyboard.press('Escape'),
    check: async (page) => !page.url().includes('view='),
    further: true,
    name: 'slow: close the product',
  },
  {
    act: (page) => page.getByRole('button', { name: 'Clear the search' }).click(),
    check: async (page) => (await rows(page).count()) === 12,
    further: true,
    name: 'slow: clear the search',
  },
  {
    // One focus, two keys: the slider keeps the focus as its setting changes.
    act: async (page) => {
      await latency(page).focus();
      for (let step = 0; step < 2; step++) {
        await page.keyboard.press('ArrowLeft');
        await page.evaluate(() => window.__framework.idle());
      }
    },
    check: async (page) => (await lab(page).innerText()).includes('0 ms'),
    further: true,
    name: 'the network as before',
  },
  {
    act: (page) => page.getByRole('button', { name: /Network lab/ }).click(),
    check: async (page) => !(await shown(lab(page))),
    further: true,
    name: 'close the lab',
  },
  {
    act: (page) => page.getByRole('link', { name: 'States' }).click(),
    check: async (page) => (await page.getByRole('region').count()) === CHARTS,
    further: true,
    name: 'open the states gallery',
  },
  {
    act: (page) => page.getByRole('link', { name: 'Back to the catalogue' }).click(),
    check: async (page) => (await rows(page).count()) === 12,
    further: true,
    name: 'back to the catalogue',
  },
];
