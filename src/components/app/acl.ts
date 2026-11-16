// Changing the catalogue needs the backend's grant to update products. A guest may still try:
// the page asks them to sign in first. Every component below inherits this decision as
// `acl.allowed`, until a folder below decides otherwise (the products' remove-link, a
// product's remove route, the bulk route).
export default ({ acl }) => acl.role === 'guest' || acl.grants.products.includes('update');
