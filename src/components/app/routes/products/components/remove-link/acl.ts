// One link, deep inside a row or a dialog, narrower than what the page allows: it needs the
// grant to delete products, and deletions not paused (the `deletions` flag, a kill switch). A guest
// may still try, and is asked to sign in.
export default ({ acl, flags }) =>
  flags.deletions && acl.allowed && (acl.role === 'guest' || acl.grants.products.includes('delete'));
