// The routes layer on React Router's data router. The router matches, keeps History, restores a
// refused traversal and renders the matched chain; this file is what the framework adds around it:
// the snapshot its files read (typed parameters, the JSON query), the typed navigation, and the
// say a chart has in a change of address.
import { type ComponentType, useMemo, useSyncExternalStore } from 'react';
import {
  type BlockerFunction,
  createPath,
  type DataRouter,
  generatePath,
  type LoaderFunctionArgs,
  type Location,
  matchRoutes,
  replace,
  useBlocker,
  useLocation,
  useNavigation,
  useParams,
} from 'react-router';

import { holdUntilReleased, useCommitted } from './activity';
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
import { bound } from './boundaries';

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
  /**
   * The address last asked for, while the router prepares it (a folder's module, a loader): what
   * the next change starts from, so two changes in a row both hold.
   */
  let asked: AddressSnapshot | undefined;
  const latest = () => asked ?? snapshot;
  const go = (href: string, replaced = false, state?: unknown) => {
    asked = read(new URL(href, 'http://framework.local'), true);
    void router.navigate(inside(href), { replace: replaced, state });
  };
  /** An address the codec would write otherwise (a default spelled out, an unknown path) is replaced by its own. */
  const settle = () => {
    if (createPath(location) !== snapshot.href) go(snapshot.href, true);
  };
  // The router preparing an address (a folder's module, a loader) counts as pending for `whenIdle()`.
  let prepared: (() => void) | undefined;
  router.subscribe((state) => {
    if (state.navigation.state !== 'idle') prepared ??= holdUntilReleased();
    else if (prepared) {
      // Prepared, or given up: the address asked for is the router's now, or nobody's.
      prepared = void prepared();
      asked = undefined;
    }
    if (state.location === location) return;
    asked = undefined;
    location = state.location;
    // The same address on another entry is the same snapshot: nothing that reads it sees a change.
    const next = read(location, true);
    const change = {
      from: snapshot,
      to: next.href === snapshot.href ? snapshot : kept(next, snapshot),
      traversal: state.historyAction === 'POP',
    };
    snapshot = change.to;
    // A chart's own write is told to nobody: the chart is in that state, and still entering it.
    const written = !change.traversal && (location.state as null | typeof HELD)?.held === true;
    if (!written && change.from.href !== change.to.href) for (const each of [...participants]) each.follows(change);
    for (const listener of listeners) listener();
    settle();
  });
  const href = (pattern: string, params: Values = {}, query: Record<string, unknown> = {}) => {
    codec.validateQuery(pattern, query);
    return codec.format(pattern, params, { ...codec.carried(latest(), pattern), ...query });
  };
  const navigation = {
    go: (pattern: string, params: Values = {}, query: Values = {}) => go(href(pattern, params, query)),
    href,
    query: (pattern: string | Values, changes?: Values) => {
      const scope = typeof pattern === 'string' ? pattern : undefined;
      const patch = typeof pattern === 'string' ? (changes ?? {}) : pattern;
      const from = latest();
      if (scope && !from.chain.some((route) => route.path === scope))
        throw new Error(`Query scope ${scope} is not active`);
      codec.validateQuery(scope, patch);
      go(codec.format(from.pattern, from.params, { ...from.query, ...patch }, from.hash));
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
    /** The snapshot of any address of the app, as the router would match it; one it does not know is home's. */
    at: (href: string): AddressSnapshot => {
      try {
        return read(new URL(href, 'http://framework.local'), true);
      } catch {
        return codec.at(undefined, {}, '', '');
      }
    },
    codec,
    getSnapshot: () => snapshot,
    /** A chart says which of its addresses its state is (address.ts); the router writes the entry. */
    hold: (own: ChartAddresses, segment: null | string) => {
      const held = heldAt(own, snapshot);
      if (held === undefined || held === segment) return;
      const pattern = segment === null ? own.pattern : `${own.pattern}/${segment}`;
      go(codec.format(pattern, snapshot.params, snapshot.query), segment === null, HELD);
    },
    /** The address being navigated to, while the router prepares it; otherwise the one it is at. */
    latest,
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
      const refused =
        createPath(currentLocation) !== createPath(nextLocation) &&
        change.to.href !== snapshot.href &&
        ![...participants].every((each) => each.agrees(change));
      if (refused) asked = undefined;
      return refused;
    }) satisfies BlockerFunction,
    replace: (to: string) => go(read(new URL(to, globalThis.location.href), true).href, true),
    /**
     * The snapshot of a location React Router is rendering (its `useLocation`, without the base):
     * the store's own when it is the router's latest, so the two are one object once it shows.
     */
    shown: (rendering: Location): AddressSnapshot =>
      rendering.key === location.key ? snapshot : kept(read(rendering, false), snapshot),
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
 * The address on screen, for the app's shell: the location React Router renders, which it changes
 * in a transition, so the page it shows and this snapshot arrive in one commit.
 */
export function useShown(address: RouterAddress) {
  const location = useLocation();
  return useMemo(() => address.shown(location), [address, location]);
}

/** Whether the router is still preparing the next address: its folders' modules, its loaders. */
export const usePreparing = () => useNavigation().state !== 'idle';

/**
 * What `Root` renders beside its page for an address: the charts' say, given to the router as its
 * blocker, and a location React has rendered and not yet shown counted as pending for `whenIdle()`.
 * It renders nothing and provides nothing.
 */
export function Navigating({ address }: { address: RouterAddress }) {
  useBlocker(address.refuses);
  useCommitted(useLocation().key);
  return null;
}

/**
 * A route folder as the router's component, with the folder's boundaries around it. Another path
 * on screen (another product) is another instance, as a keyed element is.
 */
export function routed(Folder: ComponentType, pattern: string): ComponentType {
  function Routed() {
    const base = generatePath(pattern, useParams());
    return useMemo(() => bound(<Folder key={base} />), [base]);
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
