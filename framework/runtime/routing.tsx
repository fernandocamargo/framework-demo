// The public query overload accepts either a pattern or a query object.
/* oxlint-disable anti-slop/no-runtime-typeof */
import { useMemo } from 'react';
import { type NavigateFunction, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import type { AddressCodec, AddressSnapshot, Values } from './address';
import type { Navigation, Route } from './index';

/** Navigation is the router's function, with the generated address contract in front of it. */
export function navigationFor(codec: AddressCodec, navigate: NavigateFunction, current: () => AddressSnapshot) {
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
      void navigate(inside(codec.format(from.pattern, from.params, { ...from.query, ...patch }, from.hash)), {
        replace: typeof pattern !== 'string' && changes?.['replace'] === true,
      });
    },
    replace: (pattern: string, params: Values = {}, query: Values = {}) =>
      void navigate(inside(href(pattern, params, query)), { replace: true }),
  } as Navigation;
}

/** A route folder reads React Router directly; its descendants receive ordinary props. */
export function useRoute(codec: AddressCodec): Route {
  const location = useLocation();
  const params = useParams();
  const [search] = useSearchParams();

  return useMemo(() => {
    const found = codec.read(location.pathname, search.toString(), location.hash);
    // SAFETY: The generated schema validates the parameters and query fields of Route.

    return codec.at(
      found.pattern,
      { ...Object.fromEntries(Object.entries(found.params).map(([key, value]) => [key, String(value)])), ...params },
      search.toString(),
      location.hash,
    ).route as AddressSnapshot['route'] & Route;
  }, [codec, location.pathname, location.hash, params, search]);
}

export function useNavigation(codec: AddressCodec): Navigation {
  const navigate = useNavigate();
  const location = useLocation();

  return useMemo(
    () => navigationFor(codec, navigate, () => codec.read(location.pathname, location.search, location.hash)),
    [codec, navigate, location],
  );
}
