import { format } from '@/address';
import { CURRENCY, STOCK_TONES, stockLevel } from '@/format';

export default ({ acl, async: { default: product }, i18n, intl, route }) => {
  const level = stockLevel(product.stock);
  const images: string[] = product.images.length ? product.images : product.thumbnail ? [product.thumbnail] : [];
  return {
    canEdit: acl.allowed,
    change: product.local === 'created' ? i18n.change.created : product.local === 'edited' ? i18n.change.edited : null,
    description: product.description,
    i18n,
    id: product.id,
    images: images.map((src, index) => ({
      alt: i18n.pictures.picture({ index: index + 1, title: product.title }),
      src,
    })),
    origin: [product.brand, product.category].filter(Boolean).join(' · '),
    price: intl.formatNumber(product.price, { currency: CURRENCY, style: 'currency' }),
    // The same address, with this dialog closed and the deletion asked for.
    removeHref: format({ ...route, remove: product.id, view: null }),
    stock: { label: i18n.stock({ count: product.stock, level }), tone: STOCK_TONES[level] },
    title: product.title,
  };
};

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'A product': { route: { view: 22 } },
  'One that does not exist': { route: { view: 999 } },
};
