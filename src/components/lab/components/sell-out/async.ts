export const sellOut = ({ id, services }) => (id ? services.products.sellOut(id) : Promise.resolve());
