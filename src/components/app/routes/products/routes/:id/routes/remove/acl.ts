// The same rule as the delete link's, for the dialog itself: an address that asks to delete a
// product (`?remove=4`) opens it for anyone, and only those granted deletion may confirm, while
// deletions are not paused.
export default ({ acl, flags }) =>
  flags.deletions && acl.allowed && (acl.role === 'guest' || acl.grants.products.includes('delete'));
