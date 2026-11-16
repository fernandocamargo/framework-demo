export type Props = { closeHref: string; id: number; removeHref: string };
import { AVAILABILITY, CURRENCY, stockLevel } from '@/format';

export default ({ acl, async: { default: product }, i18n, intl, removeHref }) => {
  const level = stockLevel(product.stock);
  const images: string[] = product.images.length ? product.images : product.thumbnail ? [product.thumbnail] : [];
  return {
    brand: product.brand ?? '',
    canEdit: acl.allowed,
    category: product.category,
    change: product.local ? { label: i18n.change[product.local], value: product.local } : null,
    currency: CURRENCY,
    description: product.description,
    i18n,
    id: product.id,
    images: images.map((src, index) => ({
      alt: i18n.pictures.picture({ index: index + 1, title: product.title }),
      src,
    })),
    price: { text: intl.formatNumber(product.price, { currency: CURRENCY, style: 'currency' }), value: product.price },
    // The same address, with this dialog closed and the deletion asked for.
    removeHref,
    stock: {
      availability: AVAILABILITY[level],
      count: product.stock,
      label: i18n.stock({ count: product.stock, level }),
    },
    title: product.title,
  };
};

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'A product': { props: { closeHref: '/products', id: 22, removeHref: '/products/22/remove' } },
  'One that does not exist': { props: { closeHref: '/products', id: 999, removeHref: '/products/999/remove' } },
};
