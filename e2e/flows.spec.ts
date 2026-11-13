// The main flows, in the memory world. Every step is: act, wait for the framework to say it is
// idle, then look once. No sleeps, no polling for selectors, no retried assertions: `idle()`
// resolves when no read or write is pending, no view or skin is loading, no operation is
// running and no placeholder is on screen.
import { expect, test, type Locator, type Page } from '@playwright/test'

declare global {
  interface Window {
    __framework: { idle(): Promise<void> }
  }
}

const idle = (page: Page) => page.evaluate(() => window.__framework.idle())

/** Does something, then waits until the app has nothing pending. */
async function act(page: Page, action: () => Promise<unknown>) {
  await action()
  await idle(page)
}

const open = (page: Page, hash = '#/products') => act(page, () => page.goto(`./?world=memory${hash}`))
const rows = (page: Page, name = 'Products') => page.getByRole('list', { name }).getByRole('listitem')
const titles = (page: Page) => rows(page).getByRole('link').filter({ hasNotText: /^$/ }).allInnerTexts()
const summary = (page: Page) => page.getByRole('status').first().innerText()
const dialog = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }))
const visible = (locator: Locator) => locator.isVisible()
/** react-aria keeps a radio's or a checkbox's real input visually hidden inside its label, so the label is what a person clicks. */
const choose = (locator: Locator) => locator.locator('xpath=ancestor::label').click()

async function signIn(page: Page) {
  const form = dialog(page, 'Sign in')
  await act(page, () => form.getByRole('button', { name: 'Fill it in' }).click())
  await act(page, () => form.getByRole('button', { name: 'Sign in' }).click())
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error
  })
})

test('the catalogue follows the address: search, category, sort and page', async ({ page }) => {
  await open(page)
  expect(await summary(page)).toBe('37 products')
  expect(await rows(page).count()).toBe(12)

  await act(page, async () => {
    await page.getByRole('searchbox', { name: 'Search products' }).fill('lamp')
    await page.keyboard.press('Enter')
  })
  expect(page.url()).toContain('q=lamp')
  expect(await summary(page)).toBe('3 products matching “lamp”')
  expect(await titles(page)).toEqual(['Arc Floor Lamp', 'Clamp Lamp', 'Task Lamp'])

  await act(page, async () => {
    await page.getByRole('button', { name: /Sort/ }).click()
    await page.getByRole('option', { name: 'Price, high to low' }).click()
  })
  expect(page.url()).toContain('sort=price&order=desc')
  expect(await titles(page)).toEqual(['Arc Floor Lamp', 'Clamp Lamp', 'Task Lamp'])

  await open(page, '#/products?category=desks&page=1')
  expect(await summary(page)).toBe('10 products in Desks')

  await open(page, '#/products?page=4')
  expect(await rows(page).count()).toBe(1)
  await act(page, () => page.goBack())
  expect(await summary(page)).toBe('10 products in Desks')
})

test('a product opens with its reviews, each from its own read', async ({ page }) => {
  await open(page)
  await act(page, () => page.getByRole('link', { name: 'Audio Interface', exact: true }).click())
  expect(page.url()).toContain('view=4')
  const detail = dialog(page, 'Audio Interface')
  expect(await visible(detail)).toBe(true)
  expect(await detail.getByRole('region', { name: 'Reviews' }).getByRole('listitem').count()).toBe(3)
  await act(page, () => page.keyboard.press('Escape'))
  expect(page.url()).not.toContain('view=')
})

test('editing needs a session; a save makes the list read again', async ({ page }) => {
  await open(page)
  await act(page, () => page.getByRole('link', { name: 'Edit Audio Interface' }).click())
  expect(await dialog(page, 'Sign in').innerText()).toContain('Sign in to change the catalogue.')
  await signIn(page)

  const editor = dialog(page, 'Edit Audio Interface')
  expect(await visible(editor)).toBe(true)
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill('Audio Interface Mk II'))
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click())
  expect(await visible(editor)).toBe(false)
  expect(await rows(page).nth(1).innerText()).toContain('Audio Interface Mk II')
  expect(await rows(page).nth(1).innerText()).toContain('Edited')
})

test('closing with unsaved changes asks first; a form with problems is not sent', async ({ page }) => {
  await open(page, '#/products?edit=4')
  await signIn(page)
  const editor = dialog(page, 'Edit Audio Interface')
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill(''))
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click())
  expect(await editor.innerText()).toContain('A product needs a title.')

  await act(page, () => page.keyboard.press('Escape'))
  const question = dialog(page, 'Discard your changes?')
  expect(await visible(question)).toBe(true)
  await act(page, () => question.getByRole('button', { name: 'Keep editing' }).click())
  expect(await visible(editor)).toBe(true)
  await act(page, () => page.keyboard.press('Escape'))
  await act(page, () => question.getByRole('button', { name: 'Discard' }).click())
  expect(page.url()).not.toContain('edit=')
  expect(await rows(page).nth(1).innerText()).toContain('Audio Interface')
})

test('a save after somebody else saved is a conflict, and the person chooses', async ({ page }) => {
  await open(page)
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click())
  await act(page, () => page.getByRole('link', { name: 'Edit Boom Arm' }).click())
  await signIn(page)
  const editor = dialog(page, 'Edit Boom Arm')
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill('Boom Arm, long'))
  await act(page, () => page.getByRole('button', { name: 'Sell out the product being edited' }).click())
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click())
  expect(await editor.innerText()).toContain('Somebody else changed this product')

  // Taking the newer version reads the product again: the title is back, and the stock is gone.
  await act(page, () => editor.getByRole('button', { name: 'Discard mine and reload' }).click())
  expect(await editor.getByRole('textbox', { name: 'Title' }).inputValue()).toBe('Boom Arm')
  expect(await editor.getByRole('textbox', { name: 'Stock' }).inputValue()).toBe('0')

  // The same change again, now on the newer version, is saved.
  await act(page, () => editor.getByRole('textbox', { name: 'Title' }).fill('Boom Arm, long'))
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click())
  expect(await visible(editor)).toBe(false)
  expect(await rows(page).filter({ hasText: 'Boom Arm, long' }).innerText()).toContain('Out of stock')
})

test('a product is created, then deleted after a confirmation', async ({ page }) => {
  await open(page, '#/products?signin=1')
  await signIn(page)
  await act(page, () => page.getByRole('link', { name: 'New product' }).click())
  const editor = dialog(page, 'New product')
  await editor.getByRole('textbox', { name: 'Title' }).fill('Cork Coaster')
  await editor.getByRole('button', { name: /Category/ }).click()
  await page.getByRole('option', { name: 'Desks' }).click()
  await editor.getByRole('textbox', { name: 'Price' }).fill('7.5')
  await act(page, () => editor.getByRole('button', { name: 'Create product' }).click())
  expect(await summary(page)).toBe('38 products')
  expect(await rows(page).first().innerText()).toContain('Cork Coaster')
  expect(await rows(page).first().innerText()).toContain('New')

  await act(page, () => page.getByRole('link', { name: 'Delete Cork Coaster' }).click())
  const question = dialog(page, 'Delete Cork Coaster?')
  expect(await visible(question)).toBe(true)
  await act(page, () => question.getByRole('button', { name: 'Delete' }).click())
  expect(await summary(page)).toBe('37 products')
  expect(await titles(page)).not.toContain('Cork Coaster')
})

test('the bulk price change applies a rule, lists what failed, and sends the failed ones again', async ({ page }) => {
  await open(page, '#/products?category=keyboards&signin=1')
  await signIn(page)
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click())
  const lab = page.getByRole('complementary', { name: 'Network lab' })
  await act(page, () => page.getByRole('link', { name: 'Bulk price change' }).click())
  const wizard = dialog(page, 'Bulk price change')

  await act(page, async () => {
    await wizard.getByRole('button', { name: /Category/ }).click()
    await page.getByRole('option', { name: 'Keyboards' }).click()
  })
  expect(await wizard.innerText()).toContain('9 of 9 products selected')
  await act(page, () => choose(wizard.getByRole('checkbox', { name: /Coiled Cable/ })))
  await act(page, () => wizard.getByRole('button', { name: 'Next: the rule' }).click())
  await act(page, () => wizard.getByRole('textbox', { name: 'By' }).fill('20'))
  await act(page, () => wizard.getByRole('button', { name: 'Next: preview' }).click())
  expect(await wizard.getByRole('row').count()).toBe(9)

  // Every request fails while the rule is applied: each product is tried, and each failure kept.
  await act(page, () => choose(lab.getByRole('radio', { name: '500' })))
  await act(page, () => wizard.getByRole('button', { name: 'Apply to 8' }).click())
  expect(await wizard.innerText()).toContain('0 prices changed, 8 failed.')

  await act(page, () => choose(lab.getByRole('radio', { name: 'As it should' })))
  await act(page, () => wizard.getByRole('button', { name: 'Try the 8 failed again' }).click())
  expect(await wizard.innerText()).toContain('8 prices changed.')
  await act(page, () => wizard.getByRole('button', { name: 'Done' }).click())
  // Low-Profile Keyboard: $220.99 less 20%.
  expect(await rows(page).filter({ hasText: 'Low-Profile Keyboard' }).innerText()).toContain('$176.79')
})

test('a failed read shows the error file and reaches the failure pipeline; trying again recovers', async ({ page }) => {
  await open(page)
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click())
  const lab = page.getByRole('complementary', { name: 'Network lab' })
  await act(page, () => choose(lab.getByRole('radio', { name: '500' })))
  await act(page, () => page.goto('./?world=memory#/products?category=audio'))
  expect(await page.getByRole('alert').first().innerText()).toContain('The catalogue could not be read')
  expect(await page.getByRole('region', { name: /Failures/ }).innerText()).toContain('service · products.search')

  await act(page, () => choose(lab.getByRole('radio', { name: 'As it should' })))
  await act(page, () => page.getByRole('button', { name: 'Try again' }).click())
  expect(await summary(page)).toBe('9 products in Audio')
})

test('an expired access token is refreshed once, under the save that met it', async ({ page }) => {
  await open(page, '#/products?signin=1')
  await signIn(page)
  await act(page, () => page.getByRole('button', { name: /Network lab/ }).click())
  const lab = page.getByRole('complementary', { name: 'Network lab' })
  await act(page, () => lab.getByRole('button', { name: 'Expire the access token' }).click())
  await act(page, () => page.getByRole('link', { name: 'Edit Boom Arm' }).click())
  const editor = dialog(page, 'Edit Boom Arm')
  await act(page, () => editor.getByRole('textbox', { name: 'Brand' }).fill('Northlight Audio'))
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click())
  expect(await visible(editor)).toBe(false)
  expect(await rows(page).filter({ hasText: 'Boom Arm' }).innerText()).toContain('Northlight Audio')
  // The lab reads the client's activity once a second while it is open.
  await expect(lab.getByRole('list', { name: "The API client's latest requests" })).toContainText('refreshing the access token')

  // With the refresh token revoked as well, the next save ends the session.
  await act(page, () => lab.getByRole('button', { name: 'Expire the access token' }).click())
  await act(page, () => lab.getByRole('button', { name: 'Revoke the refresh token' }).click())
  await act(page, () => page.getByRole('link', { name: 'Edit Boom Arm' }).click())
  await act(page, () => editor.getByRole('textbox', { name: 'Brand' }).fill('Northlight'))
  await act(page, () => editor.getByRole('button', { name: 'Save changes' }).click())
  expect(await editor.innerText()).toContain('Your session has expired')
})

test('the page speaks Brazilian Portuguese, and changes language in place', async ({ page }) => {
  await act(page, () => page.goto('./?world=memory&lang=pt-BR#/products'))
  expect(await page.locator('html').getAttribute('lang')).toBe('pt-BR')
  expect(await summary(page)).toBe('37 produtos')
  // Prices and ratings are written the Brazilian way; DummyJSON's product names are not translated.
  expect(await rows(page, 'Produtos').first().innerText()).toMatch(/US\$\s273,99/)
  expect(await rows(page, 'Produtos').first().innerText()).toContain('4,2')

  // A dialog's messages, its reviews' plural and average, and a date the Brazilian way.
  await act(page, () => page.getByRole('link', { name: 'Audio Interface', exact: true }).click())
  const reviews = dialog(page, 'Audio Interface').getByRole('region', { name: 'Avaliações' })
  expect(await reviews.getByRole('heading').innerText()).toMatch(/^3 avaliações, média de \d,\d$/)
  expect(await dialog(page, 'Audio Interface').getByRole('button', { name: 'Editar' }).count()).toBe(1)
  await act(page, () => page.keyboard.press('Escape'))

  await act(page, async () => {
    await page.getByRole('button', { name: 'Idioma' }).click()
    await page.getByRole('option', { name: 'English' }).click()
  })
  expect(page.url()).toContain('lang=en')
  expect(await page.locator('html').getAttribute('lang')).toBe('en')
  expect(await summary(page)).toBe('37 products')
  expect(await rows(page).first().innerText()).toContain('$273.99')
})
