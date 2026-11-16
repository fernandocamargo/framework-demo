import { links } from '@/address';
import { AVAILABILITY, CURRENCY, stockLevel } from '@/format';

export default ({ acl, async: { default: product }, i18n, intl, route }) => {
  const { href } = links(route);
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
    images: images.map((src, index) => ({
      alt: i18n.pictures.picture({ index: index + 1, title: product.title }),
      src,
    })),
    price: { text: intl.formatNumber(product.price, { currency: CURRENCY, style: 'currency' }), value: product.price },
    // The same address, with this dialog closed and the deletion asked for.
    removeHref: href('/products/:id/remove', { id: product.id }),
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
  'A product': { route: { params: { id: 22 }, pattern: '/products/:id' } },
  'One that does not exist': { route: { params: { id: 999 }, pattern: '/products/:id' } },
};
