// Orders are read by whoever the backend grants it: admins and moderators. Everything below this
// folder inherits the decision as `acl.allowed`, so the map and the ledger are not mounted, and
// read nothing, for anyone else.
export default ({ acl }) => acl.grants.orders.includes('read');
