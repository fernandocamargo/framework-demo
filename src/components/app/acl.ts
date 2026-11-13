// Who may change the catalogue: moderators and admins. Nobody signed in may still try: the page
// asks them to sign in first. Every component below inherits this as `acl.allowed`, until a
// folder below says otherwise (product/remove-link, product/remove, bulk-price).
export default ({ user }) => user === null || user.role === 'admin' || user.role === 'moderator'
