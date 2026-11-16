import { act } from '@testing-library/react';
import { createElement, type ReactNode, useEffect } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';

import type { Values } from '../address';
import type { Route } from '../index';

/** A route hook for the synthetic page used by runtime tests. */
export function useTestRoute(): Route {
  const location = useLocation();

  return {
    ...JSON.parse(new URLSearchParams(location.search).get('query') ?? '{}'),
    params: {},
    path: '/page',
    pattern: '/page',
  };
}

export function routed(_sample: Record<string, boolean | number | string>, start: Values, page: () => ReactNode) {
  const commands = new EventTarget();
  const href = (query: Values) => `/page?${new URLSearchParams({ query: JSON.stringify(query) })}`;

  function Shell() {
    const navigate = useNavigate();
    useEffect(() => {
      // SAFETY: This local event target receives only the test helper's query events.
      const go = (event: Event) => void navigate(href((event as CustomEvent<Values>).detail));
      commands.addEventListener('go', go);

      return () => commands.removeEventListener('go', go);
    }, [navigate]);

    return page();
  }

  return {
    element: createElement(MemoryRouter, { initialEntries: [href(start)] }, createElement(Shell)),
    go: (query: Values) =>
      act(async () => {
        commands.dispatchEvent(new CustomEvent('go', { detail: query }));
      }),
  };
}
