// How values read on screen. Pure functions, shared by the components' props.ts files.

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const money = (amount: number) => dollars.format(amount)

/** Below this many units, a product is running low. */
export const LOW_STOCK = 5

export type StockLevel = { tone: 'danger' | 'warn' | 'ok'; label: string }

export const stockLevel = (stock: number): StockLevel =>
  stock <= 0 ? { tone: 'danger', label: 'Out of stock' } : stock <= LOW_STOCK ? { tone: 'warn', label: `Low: ${stock} left` } : { tone: 'ok', label: `${stock} in stock` }

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

const day = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
export const date = (iso: string) => day.format(new Date(iso))

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const time = (at: number) => clock.format(at)

/** A failure's message, whatever was thrown. */
export const message = (thrown: unknown) => (thrown instanceof Error ? thrown.message : String(thrown))
