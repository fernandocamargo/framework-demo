// One row of the catalogue. It is given its product as the catalogue's read answered it, and
// the filters, so its links keep them. Prices and ratings are formatted for the locale on screen.

import { AVAILABILITY, CURRENCY, stockLevel } from '@/format';
import type { Listed } from '@/services/products/types';

export type Props = { editHref: string; product: Listed; removeHref: string; viewHref: string };

export default ({ acl, async: { setStock }, editHref, flags, i18n, intl, product, removeHref, viewHref }) => {
  const level = stockLevel(product.stock);
  // Counting stock is being rolled out (the `stockCount` flag), and needs the grant to update
  // products and someone signed in to send it.
  const counts = flags.stockCount && acl.allowed && acl.role !== 'guest';
  return {
    brand: product.brand ?? '',
    canEdit: acl.allowed,
    category: product.category,
    change: product.local ? { label: i18n.change[product.local], value: product.local } : null,
    currency: CURRENCY,
    editHref,
    editLabel: i18n.actions.edit({ title: product.title }),
    price: { text: intl.formatNumber(product.price, { currency: CURRENCY, style: 'currency' }), value: product.price },
    rating: product.rating
      ? {
          label: `${i18n.rated} ${intl.formatNumber(product.rating, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}`,
          text: intl.formatNumber(product.rating, { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
          value: product.rating,
        }
      : null,
    removeHref,
    stepper: counts
      ? {
          label: i18n.count.label({ title: product.title }),
          less: {
            disabled: product.stock === 0,
            label: i18n.count.less,
            press: () => setStock(product.id, product.stock - 1),
          },
          more: { label: i18n.count.more, press: () => setStock(product.id, product.stock + 1) },
          sending: setStock.pending,
        }
      : null,
    stock: {
      availability: AVAILABILITY[level],
      count: product.stock,
      label: i18n.stock({ count: product.stock, level }),
    },
    thumbnail: product.thumbnail,
    title: product.title,
    viewHref,
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'In stock': {
    props: {
      editHref: '/products/22/edit',
      product: {
        brand: 'Fieldwork',
        category: 'lighting',
        description: 'Arc Floor Lamp for a home office.',
        id: 22,
        price: 273.99,
        rating: 4.2,
        stock: 58,
        thumbnail:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23a07040'/%3E%3C/svg%3E",
        title: 'Arc Floor Lamp',
        version: 1,
      },
      removeHref: '/products/22/remove',
      viewHref: '/products/22',
    },
  },
  'Low, edited here': {
    props: {
      editHref: '/products/22/edit',
      product: {
        brand: 'Fieldwork',
        category: 'lighting',
        description: 'Arc Floor Lamp for a home office.',
        id: 22,
        local: 'edited',
        price: 249.99,
        rating: 4.2,
        stock: 3,
        thumbnail:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23a07040'/%3E%3C/svg%3E",
        title: 'Arc Floor Lamp',
        version: 2,
      },
      removeHref: '/products/22/remove',
      viewHref: '/products/22',
    },
  },
};
