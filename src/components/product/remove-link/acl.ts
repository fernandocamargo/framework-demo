// Deleting is for admins: one link, deep inside a row or a dialog, narrower than what the page
// allows. Nobody signed in may still try, and is asked to sign in.
export default ({ user, acl }) => acl.allowed && (user === null || user.role === 'admin')
