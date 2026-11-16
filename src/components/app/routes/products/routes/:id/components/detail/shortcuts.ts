// The product's key opens its editor, for someone who may change it.

export default ({ acl, async: { default: product }, i18n, navigation }) => ({
  e: { label: i18n.keys.edit, run: () => navigation.go('/products/:id/edit', { id: product.id }), when: acl.allowed },
});
