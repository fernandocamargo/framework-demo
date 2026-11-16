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

// Observe the Select in the page so a choice during entrance runs as soon as its animation starts.
export const startSelectTimeline = (page, during) =>
  page.evaluate((choiceName) => {
    window.__selectTimeline?.observer.disconnect();
    window.__selectTimeline?.stop();
    const events = [];

    const record = (event, detail) =>
      events.push({
        at: performance.now(),
        detail,
        event,
        running: event === 'choice' && entrance?.playState === 'running',
      });

    let popover;
    let entrance;
    let chosen = false;
    let taskPassed = false;
    let framePassed = false;

    const choose = () => {
      if (!choiceName || chosen || entrance?.playState !== 'running') return;

      const option = [...popover.querySelectorAll('[role="option"]')].find(
        (item) => item.textContent.trim() === choiceName,
      );

      if (option) {
        chosen = true;
        option.click();
      }
    };

    const watch = (node) => {
      if (popover || !node.matches?.('.react-aria-Popover')) return;
      popover = node;
      record('open');
      entrance = popover.getAnimations().find((animation) => animation.playState === 'running');

      if (entrance) {
        record('entrance start');
        entrance.finished.then(
          () => record('entrance end'),
          () => record('entrance end', 'cancelled'),
        );
        choose();
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target === popover && popover.hasAttribute('data-exiting'))
          record('data-exiting');

        for (const node of mutation.addedNodes) {
          watch(node);
          node.querySelectorAll?.('.react-aria-Popover').forEach(watch);
        }

        for (const node of mutation.removedNodes) {
          if (node === popover || node.contains?.(popover))
            record('removal', !taskPassed ? 'same task' : !framePassed ? 'by next frame' : 'later');
        }
      }
    });

    const animationStart = (event) => {
      if (event.target !== popover || entrance) return;
      entrance = popover.getAnimations().find((animation) => animation.playState === 'running');

      if (!entrance) return;
      record('entrance start');
      entrance.finished.then(
        () => record('entrance end'),
        () => record('entrance end', 'cancelled'),
      );
      choose();
    };

    const click = (event) => {
      if (!popover?.contains(event.target) || !event.target.closest('[role="option"]')) return;
      record('choice', event.target.closest('[role="option"]').textContent.trim());
      queueMicrotask(() => (taskPassed = true));
      requestAnimationFrame(() => requestAnimationFrame(() => (framePassed = true)));
    };

    document.addEventListener('animationstart', animationStart);
    document.addEventListener('click', click, true);
    observer.observe(document, { attributeFilter: ['data-exiting'], attributes: true, childList: true, subtree: true });
    window.__selectTimeline = {
      get entrance() {
        return entrance;
      },
      events,
      observer,
      stop: () => {
        document.removeEventListener('animationstart', animationStart);
        document.removeEventListener('click', click, true);
      },
    };
  }, during);

// Keep the two entrance probes for the native picker. Firefox has a platform list with no CSS entrance.
const chooseNativeSort = async (page, value, afterEntrance) => {
  const sort = page.getByRole('combobox', { name: 'Sort' });

  await sort.evaluate((select) => {
    const timeline = { custom: CSS.supports('appearance', 'base-select'), runningAtChoice: null };
    window.__nativeSortTimeline = timeline;
    select.addEventListener(
      'change',
      () => {
        timeline.runningAtChoice = select
          .getAnimations({ subtree: true })
          .some(
            (animation) => animation.effect?.pseudoElement === '::picker(select)' && animation.playState === 'running',
          );
      },
      { once: true },
    );
  });
  await sort.click();

  if (afterEntrance)
    await sort.evaluate((select) =>
      Promise.all(select.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );

  // Selection follows the platform; Escape dismisses a picker opened by the pointer.
  await sort.selectOption(value);
  await sort.press('Escape');
};

const nativeSortClosed = (page, duringEntrance) =>
  page.getByRole('combobox', { name: 'Sort' }).evaluate((select, during) => {
    const timeline = window.__nativeSortTimeline;

    return !select.matches(':open') && (!timeline.custom || timeline.runningAtChoice === during);
  }, duringEntrance);

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
      await page.getByRole('combobox', { name: 'Sort' }).selectOption('price:desc');
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
      await page.getByRole('combobox', { name: 'Category' }).selectOption('desks');
    },
    check: async (page) => (await status(page)).includes('in Desks'),
    name: 'choose a category',
  },
  {
    act: async (page) => {
      await page.getByRole('combobox', { name: 'Category' }).selectOption('all');
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
      await page.getByRole('combobox', { name: 'Sort' }).selectOption('title:asc');
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
      (await dialog(page, 'Sign in').getByRole('textbox', { name: 'Username' }).inputValue()) === 'emilys' &&
      (await dialog(page, 'Sign in').getByLabel('Password', { exact: true }).inputValue()) === 'emilyspass' &&
      (await dialog(page, 'Sign in')
        .getByRole('button', { name: /^Emily,/ })
        .getAttribute('type')) === 'button',
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
      await page.getByRole('listbox', { name: 'Category' }).getByRole('option', { name: 'Keyboards' }).click();
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
    act: (page) => page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR'),
    check: async (page) => (await status(page)) === '37 produtos',
    name: 'switch to Português (Brasil)',
  },
  {
    act: (page) => page.getByRole('combobox', { name: 'Idioma' }).selectOption('en'),
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
  {
    act: (page) => chooseNativeSort(page, 'price:asc', false),
    check: async (page) =>
      (await page.getByRole('combobox', { name: 'Sort' }).inputValue()) === 'price:asc' &&
      (await nativeSortClosed(page, true)) &&
      page.url().includes('sort=price') &&
      !page.url().includes('order='),
    further: true,
    name: 'sort during the entrance',
  },
  {
    act: (page) => chooseNativeSort(page, 'title:asc', true),
    check: async (page) =>
      (await page.getByRole('combobox', { name: 'Sort' }).inputValue()) === 'title:asc' &&
      (await nativeSortClosed(page, false)) &&
      !page.url().includes('sort='),
    further: true,
    name: 'sort after the entrance',
  },
];

// A second visit, counted on its own (`VISIT=features`): the pages and pieces the visit above does
// not open. The report, the orders page (signed in as an admin, a state, an order, the live map
// behind its flag), the command palette and the first steps of the tour.
const navigation = (page) => page.getByRole('navigation').first();
const tiles = (page) => page.getByRole('list', { name: 'Orders by state' }).locator(':scope > li');
const ledger = (page) => page.getByRole('list', { exact: true, name: 'Orders' }).locator(':scope > li');
const palette = (page) => dialog(page, 'Commands');
const tour = (page) => page.getByRole('complementary', { name: 'Guided tour' });
/** The canvas MapLibre draws on, once the map shows. */
const canvas = (page) => page.locator('figure .maplibregl-map:not([hidden]) canvas');

export const FEATURES = [
  {
    act: (page, base) => page.goto(`${base}/?world=memory#/report`),
    check: async (page) => (await page.getByRole('article').getByRole('table').first().getByRole('row').count()) > 1,
    name: 'open the stock report',
  },
  {
    act: (page) => navigation(page).getByRole('link', { name: 'Orders' }).click(),
    check: async (page) => (await page.getByRole('note').innerText()).includes('Orders are for admins and moderators.'),
    name: 'the orders, as a guest',
  },
  {
    act: async (page) => {
      await page.getByRole('link', { name: 'Sign in to see them.' }).click();
      await dialog(page, 'Sign in')
        .getByRole('button', { name: /^Emily,/ })
        .click();
      await dialog(page, 'Sign in').getByRole('button', { name: 'Sign in' }).click();
    },
    check: async (page) => (await tiles(page).count()) === 51 && (await ledger(page).count()) > 0,
    name: 'sign in as an admin: the map and the ledger',
  },
  {
    act: (page) => page.getByRole('link', { name: /^Texas,/ }).click(),
    check: async (page) => page.url().includes('region=TX') && (await ledger(page).count()) === 3,
    name: 'choose Texas',
  },
  {
    act: (page) => ledger(page).first().getByRole('link').first().click(),
    check: async (page) =>
      (await page.getByRole('dialog').getByRole('list', { name: 'Items' }).locator(':scope > li').count()) > 0,
    name: 'open an order',
  },
  {
    act: (page) => page.keyboard.press('Escape'),
    check: async (page) => !page.url().includes('cart=') && page.url().includes('region=TX'),
    name: 'close the order',
  },
  {
    // The library and the style load outside the framework: the step waits for the canvas itself.
    // Where WebGL 2 is missing the map never shows, and the check says so.
    act: async (page) => {
      await page.evaluate(serve, { liveMap: 'on' });
      await canvas(page)
        .waitFor({ timeout: 8000 })
        .catch(() => undefined);
    },
    check: async (page) => (await canvas(page).count()) === 1 && (await tiles(page).count()) === 51,
    name: 'the live map served on',
  },
  {
    // With the map on, the list shows the states that have orders.
    act: (page) => page.getByRole('link', { name: /^Florida,/ }).click(),
    check: async (page) => page.url().includes('region=FL') && (await canvas(page).count()) === 1,
    name: 'choose Florida, the map on',
  },
  {
    act: (page) => page.evaluate(serve, {}),
    check: async (page) => (await page.locator('figure .maplibregl-map').count()) === 0,
    name: 'the live map served off',
  },
  {
    act: (page) => page.keyboard.press('ControlOrMeta+k'),
    check: (page) => shown(palette(page)),
    name: 'open the command palette',
  },
  {
    // The palette searches a quarter second after the last key: a timer the framework does not see.
    act: async (page) => {
      await palette(page).getByRole('searchbox').pressSequentially('lamp');
      await page.waitForTimeout(350);
    },
    check: async (page) => (await palette(page).locator('[itemtype="https://schema.org/Product"]').count()) === 3,
    name: 'type "lamp" in the palette',
  },
  {
    act: (page) => page.keyboard.press('Enter'),
    check: async (page) => page.url().includes('view=22') && (await palette(page).count()) === 0,
    name: 'run the first command: a product',
  },
  {
    act: (page) => page.keyboard.press('Escape'),
    check: async (page) => !page.url().includes('view='),
    name: 'close the product',
  },
  {
    act: (page) => navigation(page).getByRole('link', { name: 'Products' }).click(),
    check: async (page) => (await rows(page).count()) === 12,
    name: 'back to the products',
  },
  {
    act: (page) => page.getByRole('button', { name: 'Take the tour' }).click(),
    check: async (page) => (await shown(tour(page))) && page.url().includes('sort=price'),
    name: 'take the tour: the address',
  },
  {
    act: (page) => tour(page).locator('menu li').last().getByRole('button').click(),
    check: (page) => shown(page.getByRole('dialog')),
    name: 'the tour: a product',
  },
  {
    act: (page) => tour(page).locator('menu li').last().getByRole('button').click(),
    check: async (page) => page.url().includes('page=2'),
    name: 'the tour: a slow network',
  },
  {
    act: (page) => tour(page).locator('header button').click(),
    check: async (page) => (await tour(page).count()) === 0,
    name: 'leave the tour',
  },
];
