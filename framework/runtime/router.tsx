// The routes layer on React Router's data router. The router matches, keeps History, restores a
// refused traversal and renders the matched chain; this file is what the framework adds around it:
// the snapshot its files read (typed parameters, the JSON query), the typed navigation, and the
// say a chart has in a change of address.
import { type ComponentType, type ReactNode, useMemo, useSyncExternalStore } from 'react';
import {
  type BlockerFunction,
  createPath,
  type DataRouter,
  generatePath,
  type LoaderFunctionArgs,
  type Location,
  matchRoutes,
  Outlet,
  replace,
  useBlocker,
  useLocation,
  useMatches,
  useNavigation,
  useParams,
} from 'react-router';

import type {
  AddressChange,
  AddressCodec,
  AddressOptions,
  AddressSnapshot,
  ChartAddresses,
  Participant,
  Values,
} from './address';

import { heldAt } from './address';
import { AddressContext, RouteScope } from './routes';

/** What the plugin writes on each route object: the pattern its folder is the route of. */
type Handle = undefined | { pattern?: string };
type Matched = { handle?: unknown; params: Record<string, string | undefined> };
const leafOf = (matches: null | readonly Matched[] | undefined) =>
  matches?.filter((match) => (match.handle as Handle)?.pattern !== undefined).pop();

/** What an entry a chart wrote carries: the chart is in that state, so the charts are not asked about it. */
const HELD = { held: true };

/** The address store of the document, read from the router's state. It owns no History listener. */
export function createRouterAddress(codec: AddressCodec, router: DataRouter, options: AddressOptions = {}) {
  const hashes = options.hashes ?? (() => false);
  const basename = router.basename ?? '/';
  /** A path as the router takes it: without the base. */
  const inside = (href: string) => `/${href.slice(codec.base.length)}`;
  const read = (location: Pick<Location, 'hash' | 'pathname' | 'search'>, based: boolean): AddressSnapshot => {
    const matches = matchRoutes(router.routes, location, based ? basename : '/');
    const leaf = leafOf(matches?.map((match) => ({ handle: match.route.handle, params: match.params })));
    return codec.at((leaf?.handle as Handle)?.pattern, leaf?.params ?? {}, location.search, location.hash);
  };
  let location = router.state.location;
  let snapshot = read(location, true);
  const listeners = new Set<() => void>();
  const participants = new Set<Participant>();
  /** Unchanged parameters stay the same object, so what reads them does not render for a query. */
  const kept = (next: AddressSnapshot, last: AddressSnapshot): AddressSnapshot =>
    Object.keys(last.params).length === Object.keys(next.params).length &&
    Object.keys(next.params).every((key) => next.params[key] === last.params[key])
      ? { ...next, params: last.params, route: { ...next.route, params: last.params } }
      : next;
  const go = (href: string, replaced = false, state?: unknown) =>
    void router.navigate(inside(href), { replace: replaced, state });
  /** An address the codec would write otherwise (a default spelled out, an unknown path) is replaced by its own. */
  const settle = () => {
    if (createPath(location) !== snapshot.href) go(snapshot.href, true);
  };
  router.subscribe((state) => {
    if (state.location === location) return;
    location = state.location;
    const change = { from: snapshot, to: kept(read(location, true), snapshot), traversal: state.historyAction === 'POP' };
    snapshot = change.to;
    if (change.from.href !== change.to.href) for (const each of [...participants]) each.follows(change);
    for (const listener of listeners) listener();
    settle();
  });
  const href = (pattern: string, params: Values = {}, query: Record<string, unknown> = {}) => {
    codec.validateQuery(pattern, query);
    return codec.format(pattern, params, { ...codec.carried(snapshot, pattern), ...query });
  };
  const navigation = {
    go: (pattern: string, params: Values = {}, query: Values = {}) => go(href(pattern, params, query)),
    href,
    query: (pattern: string | Values, changes?: Values) => {
      const scope = typeof pattern === 'string' ? pattern : undefined;
      const patch = typeof pattern === 'string' ? (changes ?? {}) : pattern;
      if (scope && !snapshot.chain.some((route) => route.path === scope))
        throw new Error(`Query scope ${scope} is not active`);
      codec.validateQuery(scope, patch);
      go(codec.format(snapshot.pattern, snapshot.params, { ...snapshot.query, ...patch }, snapshot.hash));
    },
  };
  /** Follows a link in place when it is to an address of the app; false for one that is the browser's. */
  const open = (link: string) => {
    const here = globalThis.location;
    const url = new URL(link, here.href);
    if (url.origin !== here.origin || !url.pathname.startsWith(codec.base)) return false;
    const known = () =>
      matchRoutes(router.routes, url, basename)?.some((match) => (match.route.handle as Handle)?.pattern) ?? false;
    if (url.hash ? !hashes(url.hash) : !known()) return false;
    go(read(url, true).href);
    return true;
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (
      !(anchor instanceof HTMLAnchorElement) ||
      anchor.hasAttribute('download') ||
      (anchor.target && anchor.target !== '_self')
    )
      return;
    if (open(anchor.href)) event.preventDefault();
  };
  return {
    codec,
    getSnapshot: () => snapshot,
    /** A chart says which of its addresses its state is (address.ts); the router writes the entry. */
    hold: (own: ChartAddresses, segment: null | string) => {
      const held = heldAt(own, snapshot);
      if (held === undefined || held === segment) return;
      const pattern = segment === null ? own.pattern : `${own.pattern}/${segment}`;
      go(codec.format(pattern, snapshot.params, snapshot.query), segment === null, HELD);
    },
    /** Plain links: the router follows its own `Link` only, and the app's links are a component library's. */
    listen: (host: Window = window) => {
      settle();
      host.document.addEventListener('click', click);
      return () => host.document.removeEventListener('click', click);
    },
    navigation,
    open,
    permit: (participant: Participant) => {
      participants.add(participant);
      return () => {
        participants.delete(participant);
      };
    },
    /**
     * The router's one blocker. Everyone is asked, and being asked changes nothing; the router
     * restores the entry a refused Back or Forward left.
     */
    refuses: (({ currentLocation, historyAction, nextLocation }) => {
      // Asked before the router has matched: the locations are without the base.
      const change: AddressChange = {
        from: snapshot,
        to: read(nextLocation, false),
        traversal: historyAction === 'POP',
      };
      // A chart's own write is the state it is already in: nobody is asked about it.
      if (historyAction !== 'POP' && (nextLocation.state as null | typeof HELD)?.held === true) return false;
      return (
        createPath(currentLocation) !== createPath(nextLocation) &&
        change.to.href !== snapshot.href &&
        ![...participants].every((each) => each.agrees(change))
      );
    }) satisfies BlockerFunction,
    replace: (to: string) => go(read(new URL(to, globalThis.location.href), true).href, true),
    /**
     * The snapshot of the location React is rendering, which the router changes in a transition:
     * the store's own when it is the router's latest, so the two are one object once it shows.
     */
    shown: (rendering: Location, matches: readonly Matched[]): AddressSnapshot =>
      rendering.key === location.key
        ? snapshot
        : kept(
            codec.at(
              (leafOf(matches)?.handle as Handle)?.pattern,
              leafOf(matches)?.params ?? {},
              rendering.search,
              rendering.hash,
            ),
            snapshot,
          ),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type RouterAddress = ReturnType<typeof createRouterAddress>;

/** The address in the bar, as soon as the router has it. */
export const useAddress = (address: RouterAddress) =>
  useSyncExternalStore(address.subscribe, address.getSnapshot, address.getSnapshot);

/**
 * The address on screen: the router's location and matches as React renders them. The router
 * changes them in a transition, so the page it shows and this snapshot arrive in one commit.
 */
export function useShown(address: RouterAddress) {
  const location = useLocation();
  const matches = useMatches();
  return useMemo(() => address.shown(location, matches), [address, location, matches]);
}

/** Whether the router is still preparing the next address: its folders' modules, its loaders. */
export const usePreparing = () => useNavigation().state !== 'idle';

/** Gives the address to what the framework renders below, and the charts' say to the router. */
export function Routing({ address, children }: { address: RouterAddress; children: ReactNode }) {
  useBlocker(address.refuses);
  return <AddressContext value={address as never}>{children}</AddressContext>;
}

/** The `routes` a folder's render places: the router's matched child. */
export const Routes = (_: { owner: string }) => <Outlet />;

/**
 * A route folder as the router's component: shown under its pattern and its path on screen, and
 * mounted again when that path is another (another product), as a keyed element is.
 */
export function routed(Folder: ComponentType, pattern: string): ComponentType {
  function Routed() {
    const params = useParams();
    const base = generatePath(pattern, params);
    return useMemo(
      () => (
        <RouteScope value={{ base, pattern }}>
          <Folder key={base} />
        </RouteScope>
      ),
      [base],
    );
  }
  Routed.displayName = `${pattern} (route)`;
  return Routed;
}

/** A route's own loader: an address its meta refuses goes home before anything of it renders. */
export const guarded =
  (codec: AddressCodec, pattern: string) =>
  ({ params, request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const found = codec.at(pattern, params, url.search, url.hash);
    if (found.pattern !== pattern) throw replace(`/${found.href.slice(codec.base.length)}`);
    return null;
  };
