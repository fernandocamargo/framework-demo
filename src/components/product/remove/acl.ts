// The same rule as the delete link's, for the dialog itself: an address that asks to delete a
// product (`?remove=4`) opens it for anyone, and only those granted deletion may confirm.
export default ({ acl }) => acl.allowed && (acl.role === 'guest' || acl.grants.products.includes('delete'))
