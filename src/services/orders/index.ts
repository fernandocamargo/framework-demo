// The orders: DummyJSON's carts, each joined with the customer it belongs to. Reads only. The
// API answers a cart and a user apart, so the join is here, and a cart whose user is missing is
// left out.

import type { Customer, Detailed, Line, Order } from './types';

type Cart = {
  discountedTotal: number;
  id: number;
  products: {
    discountedTotal: number;
    id: number;
    price: number;
    quantity: number;
    thumbnail: string;
    title: string;
  }[];
  totalProducts: number;
  totalQuantity: number;
  userId: number;
};
type User = {
  address: { address: string; city: string; country: string; postalCode: string; stateCode: string };
  firstName: string;
  id: number;
  lastName: string;
};

const SELECT_CARTS = 'userId,total,discountedTotal,totalProducts,totalQuantity';
const SELECT_USER = 'firstName,lastName,address';

const customerOf = (user: User): Customer => ({
  address: {
    city: user.address.city,
    country: user.address.country,
    postalCode: user.address.postalCode,
    region: user.address.stateCode,
    street: user.address.address,
  },
  firstName: user.firstName,
  id: user.id,
  lastName: user.lastName,
});

/** Every order, sorted by id. */
export const list =
  ({ clients: { api } }) =>
  async (): Promise<Order[]> => {
    const [{ carts }, { users }] = await Promise.all([
      api.get<{ carts: Cart[] }>('/carts', { query: { limit: 0, select: SELECT_CARTS } }),
      api.get<{ users: User[] }>('/users', { query: { limit: 0, select: SELECT_USER } }),
    ]);
    const byId = new Map(users.map((user) => [user.id, user]));
    return carts
      .flatMap((cart): Order[] => {
        const user = byId.get(cart.userId);
        return user
          ? [
              {
                customer: customerOf(user),
                id: cart.id,
                items: cart.totalProducts,
                quantity: cart.totalQuantity,
                total: cart.discountedTotal,
              },
            ]
          : [];
      })
      .sort((a, b) => a.id - b.id);
  };

/** One order, with its lines. Rejects when there is no such cart. */
export const get =
  ({ clients: { api } }) =>
  async (id: number): Promise<Detailed> => {
    const cart = await api.get<Cart>(`/carts/${id}`);
    const user = await api.get<User>(`/users/${cart.userId}`, { query: { select: SELECT_USER } });
    const lines = cart.products.map((product): Line => ({
      id: product.id,
      price: product.price,
      quantity: product.quantity,
      thumbnail: product.thumbnail,
      title: product.title,
      total: product.discountedTotal,
    }));
    return {
      customer: customerOf(user),
      id: cart.id,
      items: cart.totalProducts,
      lines,
      quantity: cart.totalQuantity,
      total: cart.discountedTotal,
    };
  };
