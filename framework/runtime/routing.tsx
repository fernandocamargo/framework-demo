// The public query overload accepts either a pattern or a query object.
/* oxlint-disable anti-slop/no-runtime-typeof */
import { use, useMemo } from 'react';
import { type NavigateOptions, UNSAFE_NavigationContext, useLocation } from 'react-router';

import type { AddressCodec, AddressSnapshot, Values } from './address';
import type { Navigation, Route } from './index';

/** Navigation is the router's function, with the generated address contract in front of it. */
export function navigationFor(
  codec: AddressCodec,
  navigate: (href: string, options?: NavigateOptions) => void,
  current: () => AddressSnapshot,
) {
  const inside = (href: string) => `/${href.slice(codec.base.length)}`;

  const href = (pattern: string, params: Values = {}, query: Values = {}) => {
    codec.validateQuery(pattern, query);

    return codec.format(pattern, params, { ...codec.carried(current(), pattern), ...query });
  };
  // SAFETY: The codec checks each pattern, parameter and query before calling the router.

  return {
    go: (pattern: string, params: Values = {}, query: Values = {}) =>
      void navigate(inside(href(pattern, params, query))),
    href,
    query: (pattern: string | Values, changes?: Values | { replace: boolean }) => {
      const scope = typeof pattern === 'string' ? pattern : undefined;
      // SAFETY: A scoped query has field values as its second argument.
      const patch = typeof pattern === 'string' ? (changes as Values) : pattern;
      const from = current();

      if (scope && !from.chain.some((route) => route.path === scope))
        throw new Error(`Query scope ${scope} is not active`);
      codec.validateQuery(scope, patch);
      const next = codec.format(from.pattern, from.params, { ...from.query, ...patch }, from.hash);

      if (next === from.href) return;
      void navigate(inside(next), {
        replace: typeof pattern !== 'string' && changes?.['replace'] === true,
      });
    },
    replace: (pattern: string, params: Values = {}, query: Values = {}) =>
      void navigate(inside(href(pattern, params, query)), { replace: true }),
  } as Navigation;
}

/** The router adapter reads the address; the folder's view follows only the fields it uses. */
export function useRoute(codec: AddressCodec): Route {
  const location = useLocation();

  return useMemo(
    // SAFETY: The generated schema validates the route's parameters and query fields.
    () => codec.read(location.pathname, location.search, location.hash).route as AddressSnapshot['route'] & Route,
    [codec, location.pathname, location.search, location.hash],
  );
}

export function useNavigation(codec: AddressCodec): Navigation {
  const { navigator } = use(UNSAFE_NavigationContext);

  return useMemo(() => {
    // SAFETY: BrowserRouter and MemoryRouter supply their history as the navigator.
    const history = navigator as typeof navigator & {
      readonly location: { hash: string; pathname: string; search: string };
    };

    return navigationFor(
      codec,
      (href, options) => navigator[options?.replace ? 'replace' : 'push'](`${codec.base}${href.slice(1)}`),
      () => {
        const { hash, pathname, search } = history.location;

        return codec.read(`/${pathname.slice(codec.base.length)}`, search, hash);
      },
    );
  }, [codec, navigator]);
}
