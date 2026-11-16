// A read of its own, beside the product's: it has its own placeholder and its own error file,
// so slow or failing reviews leave the rest of the dialog alone.
export default ({ route, services }) => services.products.reviews(route.params.id ?? 0);
