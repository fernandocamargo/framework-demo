// What the report shows, worked out from what its read answered, in the page's words and the
// locale on screen. The figures and the lead are summary.ts's; this file only words and links them.

import { format, HOME, href } from '@/address';
import { AVAILABILITY, CURRENCY, LOW_STOCK, stockLevel } from '@/format';

import { byCategory, lead, shortest, totals } from './summary';

export default ({ async: { default: answer }, i18n, intl }) => {
  const { asOf, categories, products } = answer;
  const names = new Map(categories.map(({ name, slug }) => [slug, name]));
  const named = (slug: string) => names.get(slug) ?? slug;
  const figures = totals(products);
  const top = lead(products);
  const rows = byCategory(products);
  const largest = Math.max(1, ...rows.map((row) => row.units));
  const money = (amount: number) => intl.formatNumber(amount, { currency: CURRENCY, style: 'currency' });
  const number = (amount: number) => intl.formatNumber(amount);
  return {
    asOf,
    dated: intl.formatDate(asOf, { dateStyle: 'long', timeStyle: 'short' }),
    deck: i18n.deck({
      kind: top.kind,
      low: figures.low,
      out: figures.out,
      units: figures.units,
      value: money(figures.value),
    }),
    figures: [
      { key: 'products', label: i18n.figures.products, text: number(figures.products), value: figures.products },
      { key: 'units', label: i18n.figures.units, text: number(figures.units), value: figures.units },
      { key: 'value', label: i18n.figures.value, text: money(figures.value), value: figures.value },
      { key: 'out', label: i18n.figures.out, text: number(figures.out), value: figures.out },
      { key: 'low', label: i18n.figures.low, text: number(figures.low), value: figures.low },
    ],
    headline: i18n.headline({
      category: 'category' in top ? named(top.category) : '',
      count: 'count' in top ? top.count : 0,
      kind: top.kind,
      limit: LOW_STOCK,
    }),
    i18n,
    rows: rows.map((row) => ({
      highPrice: { text: money(row.high), value: row.high },
      href: format({ ...HOME, category: row.category }),
      key: row.category,
      lowPrice: { text: money(row.lowest), value: row.lowest },
      meter: { max: largest, value: row.units },
      name: named(row.category),
      offers: { text: number(row.products), value: row.products },
      units: { text: number(row.units), value: row.units },
      value: money(row.value),
    })),
    shortest: shortest(products).map((product) => {
      const level = stockLevel(product.stock);
      return {
        availability: AVAILABILITY[level],
        href: href(HOME, { view: product.id }),
        id: product.id,
        label: i18n.stock({ count: product.stock, level }),
        stock: product.stock,
        title: product.title,
      };
    }),
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The report': {},
};
