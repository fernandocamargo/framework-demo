// Changing the catalogue needs the backend's grant to update products. A guest may still try:
// the page asks them to sign in first. Every component below inherits this decision as
// `acl.allowed`, until a folder below decides otherwise (product/remove-link, product/remove,
// bulk-price).
export default ({ acl }) => acl.role === 'guest' || acl.grants.products.includes('update');
