// What the components share about how values read. The words are each component's own
// (its i18n.ts), and numbers, prices and dates are formatted for the locale on screen (`intl`).

/** Below this many units, a product is running low. */
export const LOW_STOCK = 5;

/** Prices are in dollars, as DummyJSON keeps them, whatever the locale. */
export const CURRENCY = 'USD';

/** How a stock level reads: out, low or in stock. Each component words it in its messages. */
export const stockLevel = (stock: number) => (stock <= 0 ? 'out' : stock <= LOW_STOCK ? 'low' : 'in');

/** The tone a stock level is shown in. */
export const STOCK_TONES = { in: 'ok', low: 'warn', out: 'danger' } as const;

/** A failure's message, whatever was thrown. */
export const message = (thrown: unknown) => (thrown instanceof Error ? thrown.message : String(thrown));
