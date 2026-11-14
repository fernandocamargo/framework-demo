// DummyJSON, answered in memory: the endpoints this app calls, with the same paths, parameters,
// statuses and messages, including its `delay` parameter and its `/http/<status>` helper. Like
// DummyJSON, it echoes writes and keeps nothing.

import type { Product } from '@/services/products/types';

import type { Wire } from '../dummyjson/http';
import { permissionsOf } from '../permissions';
import { sleep } from '../storage';
import * as fixtures from './fixtures';

type Data = {
  carts: typeof fixtures.carts;
  categories: { name: string; slug: string }[];
  customers: typeof fixtures.customers;
  products: Product[];
  users: typeof fixtures.users;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status });

export function createServer({
  data = fixtures as Data,
  now = Date.now,
}: { data?: Data; now?: () => number } = {}): Wire {
  let issued = 0;
  const tokens = (id: number, minutes: number) => ({
    accessToken: `access.${id}.${now() + minutes * 60_000}`,
    refreshToken: `refresh.${id}.${(issued += 1)}`,
  });
  /** The user a request's access token names, while it is good; null otherwise. */
  const signedIn = (init: RequestInit) => {
    const [, token = ''] = /^Bearer (.+)$/.exec(new Headers(init.headers).get('authorization') ?? '') ?? [];
    const [kind, id, expiresAt, extra] = token.split('.');
    return kind === 'access' && extra === undefined && Number(expiresAt) > now()
      ? (data.users.find((user) => user.id === Number(id)) ?? null)
      : null;
  };

  const page = (items: Product[], query: URLSearchParams) => {
    const sortBy = query.get('sortBy') as keyof Product | null;
    const sorted = sortBy
      ? [...items].sort((a, b) => {
          const [x, y] = [a[sortBy], b[sortBy]];
          const order = typeof x === 'string' ? x.localeCompare(String(y)) : Number(x) - Number(y);
          return query.get('order') === 'desc' ? -order : order;
        })
      : items;
    const skip = Number(query.get('skip') ?? 0);
    const limit = Number(query.get('limit') ?? 30) || sorted.length;
    const fields = query.get('select')?.split(',');
    const selected = sorted.slice(skip, skip + limit).map((product) => select(product, fields));
    return { limit: selected.length, products: selected, skip, total: items.length };
  };
  const select = <T extends { id: number }>(product: T, fields?: string[]) =>
    fields
      ? Object.fromEntries([
          ['id', product.id],
          ...fields.filter((field) => field in product).map((field) => [field, product[field as keyof T]]),
        ])
      : product;
  // A list of carts or users, paged and selected as the products are; the key names the list.
  const listing = <T extends { id: number }>(key: string, items: T[], query: URLSearchParams) => {
    const skip = Number(query.get('skip') ?? 0);
    const limit = Number(query.get('limit') ?? 30) || items.length;
    const fields = query.get('select')?.split(',');
    const selected = items.slice(skip, skip + limit).map((item) => select(item, fields));
    return { [key]: selected, limit: selected.length, skip, total: items.length };
  };

  const route = (
    method: string,
    path: string,
    query: URLSearchParams,
    body: Record<string, unknown>,
    init: RequestInit,
  ): Response => {
    const status = /^\/http\/(\d{3})$/.exec(path);
    if (status)
      return json(Number(status[1]), {
        message: `The server answered ${status[1]}.`,
        status: status[1],
        title: 'Forced by the network lab',
      });

    if (path === '/auth/login' && method === 'POST') {
      const found = data.users.find((user) => user.username === body['username'] && user.password === body['password']);
      if (!found) return json(400, { message: 'Invalid credentials' });
      // DummyJSON's login answers no role; /auth/me does.
      const { password: _, role: __, ...user } = found;
      return json(200, { ...user, ...tokens(found.id, Number(body['expiresInMins'] ?? 60)) });
    }
    if (path === '/auth/refresh' && method === 'POST') {
      const refresh = /^refresh\.(\d+)\.\d+$/.exec(String(body['refreshToken']));
      if (!refresh) return json(403, { message: 'Invalid refresh token' });
      return json(200, tokens(Number(refresh[1]), Number(body['expiresInMins'] ?? 60)));
    }
    // A backend's permissions: a guest's without a token, the token's person's with one.
    if (path === '/auth/permissions' && method === 'GET') {
      if (!new Headers(init.headers).get('authorization')) return json(200, permissionsOf(null));
      const user = signedIn(init);
      return user ? json(200, permissionsOf(user.role)) : json(401, { message: 'Invalid/Expired Token!' });
    }
    const needsToken = path.startsWith('/auth/');
    if (needsToken && !signedIn(init)) return json(401, { message: 'Invalid/Expired Token!' });
    if (path === '/auth/me' && method === 'GET') {
      const { password: _, ...user } = signedIn(init)!;
      return json(200, user);
    }
    const resource = needsToken ? path.slice('/auth'.length) : path;

    if (method === 'GET' && resource === '/products') return json(200, page(data.products, query));
    if (method === 'GET' && resource === '/products/categories') return json(200, data.categories);
    if (method === 'GET' && resource === '/products/search') {
      const q = (query.get('q') ?? '').toLowerCase();
      return json(
        200,
        page(
          data.products.filter((product) => `${product.title} ${product.description}`.toLowerCase().includes(q)),
          query,
        ),
      );
    }
    const category = /^\/products\/category\/([\w-]+)$/.exec(resource);
    if (method === 'GET' && category)
      return json(
        200,
        page(
          data.products.filter((product) => product.category === category[1]),
          query,
        ),
      );
    if (method === 'POST' && resource === '/products/add') return json(201, { id: data.products.length + 1, ...body });

    const one = /^\/products\/(\d+)$/.exec(resource);
    const product = one && data.products.find((candidate) => candidate.id === Number(one[1]));
    if (one && !product) return json(404, { message: `Product with id '${one[1]}' not found` });
    if (product && method === 'GET') return json(200, select(product, query.get('select')?.split(',')));
    if (product && method === 'PUT') return json(200, { ...product, ...body });
    if (product && method === 'DELETE')
      return json(200, { ...product, deletedOn: new Date(now()).toISOString(), isDeleted: true });

    if (method === 'GET' && resource === '/carts') return json(200, listing('carts', data.carts, query));
    if (method === 'GET' && resource === '/users') return json(200, listing('users', data.customers, query));
    const cartId = /^\/carts\/(\d+)$/.exec(resource);
    const cart = cartId && data.carts.find((candidate) => candidate.id === Number(cartId[1]));
    if (cartId && !cart) return json(404, { message: `Cart with id '${cartId[1]}' not found` });
    if (cart && method === 'GET') return json(200, select(cart, query.get('select')?.split(',')));
    const userId = /^\/users\/(\d+)$/.exec(resource);
    const customer = userId && data.customers.find((candidate) => candidate.id === Number(userId[1]));
    if (userId && !customer) return json(404, { message: `User with id '${userId[1]}' not found` });
    if (customer && method === 'GET') return json(200, select(customer, query.get('select')?.split(',')));
    return json(404, { message: `No route for ${method} ${path}` });
  };

  return async (address, init) => {
    const url = new URL(address);
    const delay = Math.min(Number(url.searchParams.get('delay') ?? 0), 5000);
    if (delay) await sleep(delay, init.signal ?? undefined);
    init.signal?.throwIfAborted();
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    return route(init.method ?? 'GET', url.pathname, url.searchParams, body, init);
  };
}
