// The same rule as the delete link's, for the dialog itself: an address that asks to delete a
// product (`?remove=4`) opens it for anyone, and only admins may confirm.
export default ({ user, acl }) => acl.allowed && (user === null || user.role === 'admin')
