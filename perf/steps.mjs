// The flow perf/cycles.mjs measures, in the memory world: what a person does in one visit. Each
// step acts, waits for `window.__framework.idle()`, then checks the page once. A check that fails
// right after `idle()` is a miss: the signal resolved before the page was done.
const dialog = (page, name) => page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }))
const rows = (page) => page.getByRole('list', { name: 'Products' }).getByRole('listitem')
const shown = async (locator) => (await locator.count()) > 0 && (await locator.first().isVisible())
const status = (page) => page.getByRole('status').first().innerText()

export const STEPS = [
  {
    name: 'open the catalogue',
    act: (page, base) => page.goto(`${base}/?world=memory#/products`),
    check: async (page) => (await rows(page).count()) === 12,
  },
  {
    name: 'search for "lamp"',
    act: async (page) => {
      await page.getByRole('searchbox', { name: 'Search products' }).fill('lamp')
      await page.keyboard.press('Enter')
    },
    check: async (page) => (await rows(page).count()) === 3,
  },
  {
    name: 'sort by price, high to low',
    act: async (page) => {
      await page.getByRole('button', { name: /Sort/ }).click()
      await page.getByRole('option', { name: 'Price, high to low' }).click()
    },
    check: async (page) => page.url().includes('sort=price&order=desc'),
  },
  {
    name: 'clear the search',
    act: (page) => page.getByRole('button', { name: 'Clear the search' }).click(),
    check: async (page) => (await rows(page).count()) === 12,
  },
  {
    name: 'choose a category',
    act: async (page) => {
      await page.getByRole('button', { name: /Category/ }).click()
      await page.getByRole('option', { name: 'Desks' }).click()
    },
    check: async (page) => (await status(page)).includes('in Desks'),
  },
  {
    name: 'all categories, page 2',
    act: async (page) => {
      await page.getByRole('button', { name: /Category/ }).click()
      await page.getByRole('option', { name: 'All categories' }).click()
      await page.getByRole('link', { name: 'Next' }).click()
    },
    check: async (page) => page.url().includes('page=2'),
  },
  {
    name: 'back to page 1',
    act: (page) => page.getByRole('link', { name: 'Previous' }).click(),
    check: async (page) => !page.url().includes('page='),
  },
  {
    name: 'sort by title again',
    act: async (page) => {
      await page.getByRole('button', { name: /Sort/ }).click()
      await page.getByRole('option', { name: 'Title, A to Z' }).click()
    },
    check: async (page) => !page.url().includes('sort='),
  },
  {
    name: 'open a product',
    act: (page) => page.getByRole('link', { name: 'Audio Interface', exact: true }).click(),
    check: async (page) => (await dialog(page, 'Audio Interface').getByRole('region', { name: 'Reviews' }).getByRole('listitem').count()) === 3,
  },
  {
    name: 'close the product',
    act: (page) => page.keyboard.press('Escape'),
    check: async (page) => !page.url().includes('view='),
  },
  {
    name: 'edit, which asks to sign in',
    act: (page) => page.getByRole('link', { name: 'Edit Audio Interface' }).click(),
    check: (page) => shown(dialog(page, 'Sign in')),
  },
  {
    name: 'fill the demo account in',
    act: (page) => dialog(page, 'Sign in').getByRole('button', { name: 'Fill it in' }).click(),
    check: async (page) => (await dialog(page, 'Sign in').getByRole('textbox', { name: 'Username' }).inputValue()) !== '',
  },
  {
    name: 'sign in',
    act: (page) => dialog(page, 'Sign in').getByRole('button', { name: 'Sign in' }).click(),
    check: (page) => shown(dialog(page, 'Edit Audio Interface')),
  },
  {
    name: 'type six keys in the title',
    act: async (page) => {
      const title = dialog(page, 'Edit Audio Interface').getByRole('textbox', { name: 'Title' })
      await title.press('End')
      await title.pressSequentially(' Mk II')
    },
    check: async (page) => (await dialog(page, /Edit Audio Interface/).getByRole('textbox', { name: 'Title' }).inputValue()) === 'Audio Interface Mk II',
  },
  {
    name: 'save',
    act: (page) => dialog(page, /Edit Audio Interface/).getByRole('button', { name: 'Save changes' }).click(),
    check: async (page) => (await rows(page).filter({ hasText: 'Audio Interface Mk II' }).filter({ hasText: 'Edited' }).count()) === 1,
  },
  {
    name: 'open the bulk price change',
    act: (page) => page.getByRole('link', { name: 'Bulk price change' }).click(),
    check: (page) => shown(dialog(page, 'Bulk price change')),
  },
  {
    name: 'choose the keyboards',
    act: async (page) => {
      await dialog(page, 'Bulk price change').getByRole('button', { name: /Category/ }).click()
      await page.getByRole('option', { name: 'Keyboards' }).click()
    },
    check: async (page) => (await dialog(page, 'Bulk price change').innerText()).includes('9 of 9 products selected'),
  },
  {
    name: 'next: the rule',
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Next: the rule' }).click(),
    check: (page) => shown(dialog(page, 'Bulk price change').getByRole('textbox', { name: 'By' })),
  },
  {
    name: 'type 15 as the percentage',
    act: (page) => dialog(page, 'Bulk price change').getByRole('textbox', { name: 'By' }).fill('15'),
    check: async (page) => (await dialog(page, 'Bulk price change').getByRole('textbox', { name: 'By' }).inputValue()).startsWith('15'),
  },
  {
    name: 'next: preview',
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Next: preview' }).click(),
    check: async (page) => (await dialog(page, 'Bulk price change').getByRole('row').count()) === 10,
  },
  {
    name: 'apply to the nine',
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Apply to 9' }).click(),
    check: async (page) => (await dialog(page, 'Bulk price change').innerText()).includes('9 prices changed.'),
  },
  {
    name: 'done',
    act: (page) => dialog(page, 'Bulk price change').getByRole('button', { name: 'Done' }).click(),
    check: async (page) => !page.url().includes('bulk='),
  },
  {
    name: 'open the network lab',
    act: (page) => page.getByRole('button', { name: /Network lab/ }).click(),
    check: (page) => shown(page.getByRole('complementary', { name: 'Network lab' })),
  },
  {
    name: 'switch to Português (Brasil)',
    act: async (page) => {
      await page.getByRole('button', { name: 'Language' }).click()
      await page.getByRole('option', { name: 'Português (Brasil)' }).click()
    },
    check: async (page) => (await status(page)) === '37 produtos',
  },
  {
    name: 'back to English',
    act: async (page) => {
      await page.getByRole('button', { name: 'Idioma' }).click()
      await page.getByRole('option', { name: 'English' }).click()
    },
    check: async (page) => (await status(page)) === '37 products',
  },
  {
    name: 'sign out',
    act: (page) => page.getByRole('button', { name: 'Sign out' }).click(),
    check: (page) => shown(page.getByRole('button', { name: 'Sign in' })),
  },
]
