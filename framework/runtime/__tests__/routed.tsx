import { act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createCodec, type Field } from '../address';
import { createRouterAddress, type RouterAddress } from '../router';

type Values = Record<string, boolean | number | string>;

/**
 * A page under React Router, in memory: one route, `/page`, whose query declares a field for each
 * key of `sample` (its type is the sample value's). `page` gives what the root route renders, with
 * the address to hand to `Root`. `go` moves to another query and waits for the router.
 */
export function routed(sample: Values, start: Values, page: (address: RouterAddress) => ReactNode) {
  const query = Object.fromEntries(
    Object.entries(sample).map(([key, value]) => [key, { type: typeof value } as Field]),
  );
  const codec = createCodec([{ folder: 'page', keys: [], owner: '', params: {}, path: '/page', query }], {}, '/page');
  const Shell = () => page(address);
  const router = createMemoryRouter(
    [{ children: [{ handle: { pattern: '/page' }, path: 'page' }], Component: Shell, path: '/' }],
    { initialEntries: [codec.format('/page', {}, start)] },
  );
  const address = createRouterAddress(codec, router);
  return {
    address,
    element: createElement(RouterProvider, { router }),
    go: (route: Values) =>
      act(async () => {
        await router.navigate(codec.format('/page', {}, route));
      }),
    router,
  };
}
