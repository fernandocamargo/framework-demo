// One link, deep inside a row or a dialog, narrower than what the page allows: it needs the
// grant to delete products. A guest may still try, and is asked to sign in.
export default ({ acl }) => acl.allowed && (acl.role === 'guest' || acl.grants.products.includes('delete'))
