// A link to delete a product: shown only to those allowed to delete it.
export type Props = {
  /** The address that asks to delete it. */
  href: string
  /** The product's title, for the link's name. */
  title: string
  /** An icon in a row, or words in a dialog. */
  variant: 'icon' | 'text'
}

export default ({ href, title, variant, acl, i18n }) => ({
  shown: acl.allowed,
  href,
  icon: variant === 'icon',
  label: i18n.label({ title }),
  text: i18n.text,
})
