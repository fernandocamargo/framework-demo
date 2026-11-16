// The address cannot bypass the backend's grant to read an order.
export default ({ acl }) => ({ allowed: acl.grants.orders.includes('read') });
