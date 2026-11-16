// A link to delete a product: shown only to those allowed to delete it. Its name says which
// product; where it shows, a skin may draw it as its glyph alone.
export type Props = {
  /** The address that asks to delete it. */
  href: string;
  /** The product's title, for the link's name. */
  title: string;
};

export default ({ acl, href, i18n, title }) => ({
  href,
  label: i18n.label({ title }),
  shown: acl.allowed,
});

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'A product': { props: { href: '/products/22/remove', title: 'Arc Floor Lamp' } },
};
