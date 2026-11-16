// The product's editor and its removal open over the detail, which stays under them.
export default ({ route, routes }) => ({ covered: route.pattern !== '/products/:id', routes });
