// The report's figures, worked out from the products the inventory read answered. Pure: no React,
// no framework. A product is out when it has none left, and low when it has at most LOW_STOCK.

import { LOW_STOCK } from '@/format';
import type { Listed } from '@/services/products/types';

/** How many products the ranking of the ones closest to running out holds. */
export const SHORTEST = 10;

export type Totals = { low: number; out: number; products: number; units: number; value: number };

export type CategoryRow = {
  category: string;
  high: number;
  low: number;
  lowest: number;
  out: number;
  products: number;
  units: number;
  value: number;
};

/** The headline's subject: the shop has products out, a category runs short, or nothing does. */
export type Lead = { category: string; count: number; kind: 'low' } | { count: number; kind: 'out' } | { kind: 'calm' };

const isOut = (product: Listed) => product.stock <= 0;
const isLow = (product: Listed) => product.stock > 0 && product.stock <= LOW_STOCK;
const sum = (numbers: number[]) => numbers.reduce((total, number) => total + number, 0);
/** The stock on hand, in money, to the cent. */
const worth = (products: Listed[]) =>
  Math.round(sum(products.map((product) => product.price * product.stock)) * 100) / 100;

export const totals = (products: Listed[]): Totals => ({
  low: products.filter(isLow).length,
  out: products.filter(isOut).length,
  products: products.length,
  units: sum(products.map((product) => product.stock)),
  value: worth(products),
});

/** One row per category, the most valuable first. */
export const byCategory = (products: Listed[]): CategoryRow[] => {
  const groups = new Map<string, Listed[]>();
  for (const product of products) groups.set(product.category, [...(groups.get(product.category) ?? []), product]);
  return [...groups]
    .map(([category, items]) => {
      const prices = items.map((product) => product.price);
      return {
        category,
        high: Math.max(...prices),
        low: items.filter(isLow).length,
        lowest: Math.min(...prices),
        out: items.filter(isOut).length,
        products: items.length,
        units: sum(items.map((product) => product.stock)),
        value: worth(items),
      };
    })
    .sort((a, b) => b.value - a.value || a.category.localeCompare(b.category));
};

/** The products with the least stock, ties by title. */
export const shortest = (products: Listed[]): Listed[] =>
  [...products].sort((a, b) => a.stock - b.stock || a.title.localeCompare(b.title)).slice(0, SHORTEST);

/** What the headline is about: anything out of stock first, then the category with most low products. */
export const lead = (products: Listed[]): Lead => {
  const out = products.filter(isOut).length;
  if (out > 0) return { count: out, kind: 'out' };
  // The rows come most valuable first, so a tie goes to the more valuable category.
  const top = byCategory(products).reduce<CategoryRow | null>(
    (best, row) => (row.low > (best?.low ?? 0) ? row : best),
    null,
  );
  return top ? { category: top.category, count: top.low, kind: 'low' } : { kind: 'calm' };
};
