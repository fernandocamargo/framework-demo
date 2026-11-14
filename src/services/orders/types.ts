// The orders' shapes: a cart of DummyJSON, as an order, with the customer it ships to.

export type Address = {
  city: string;
  country: string;
  postalCode: string;
  /** The state's code, as in `TX`. DummyJSON's coordinates are random, so this is what places an order. */
  region: string;
  street: string;
};

export type Customer = { address: Address; firstName: string; id: number; lastName: string };

/** One product of an order: what the customer pays for it, after the discount. */
export type Line = { id: number; price: number; quantity: number; thumbnail: string; title: string; total: number };

/** A cart as an order. `total` is what the customer pays, after the discount. */
export type Order = {
  customer: Customer;
  id: number;
  items: number;
  quantity: number;
  total: number;
};

export type Detailed = Order & { lines: Line[] };
