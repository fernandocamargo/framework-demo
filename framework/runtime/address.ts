/** The generated schema validates links; the address store owns History and publishes one snapshot. */
export type Field = {
  default?: boolean | number | string;
  enum?: readonly string[];
  maxLength?: number;
  min?: number;
  pattern?: string;
  type: 'boolean' | 'integer' | 'number' | 'string';
};
export type Fields = Record<string, Field>;
export type Values = Record<string, boolean | number | string>;
export type RouteDefinition = {
  chart?: { component: string; state: string };
  folder: string;
  keys: string[];
  owner: string;
  params: Fields;
  path: string;
  query: Fields;
  test: RegExp;
};
export type AddressSnapshot = {
  chain: readonly RouteDefinition[];
  hash: string;
  href: string;
  params: Values;
  path: string;
  pattern: string;
  query: Values;
  route: Record<string, unknown> & { params: Values; path: string; pattern: string };
};
type PathPattern = { exec(input: { pathname: string }): null | { pathname: { groups: Record<string, string> } } };

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const valid = (value: unknown, field: Field) => {
  if (field.type === 'integer' ? !Number.isSafeInteger(value) : typeof value !== field.type) return false;
  if (typeof value === 'number' && (!Number.isFinite(value) || (field.min !== undefined && value < field.min)))
    return false;
  if (typeof value === 'string') {
    if (field.enum && !field.enum.includes(value)) return false;
    if (value.length > (field.maxLength ?? 1024)) return false;
    if (field.pattern && !new RegExp(field.pattern).test(value)) return false;
  }
  return true;
};
const defaults = (fields: Fields): Values =>
  Object.fromEntries(
    Object.entries(fields).flatMap(([key, field]) => (field.default === undefined ? [] : [[key, field.default]])),
  );
const clean = (fields: Fields, values: Record<string, unknown>): Values =>
  Object.fromEntries(
    Object.entries(fields).flatMap(([key, field]) =>
      valid(values[key], field)
        ? [[key, values[key] as Values[string]]]
        : field.default === undefined
          ? []
          : [[key, field.default]],
    ),
  );

export function createCodec(definitions: readonly RouteDefinition[], global: Fields, home: string, base = '/') {
  const prefix = `/${base.split('/').filter(Boolean).join('/')}${base === '/' ? '' : '/'}`;
  const all = Object.assign({}, global, ...definitions.map((route) => route.query)) as Fields;
  const byPath = new Map(definitions.map((route) => [route.path, route]));
  const Pattern = (globalThis as { URLPattern?: new (input: { pathname: string }) => PathPattern }).URLPattern;
  const patterns = Pattern && new Map(definitions.map((route) => [route, new Pattern({ pathname: route.path })]));
  const homeRoute = byPath.get(home);
  if (!homeRoute) throw new Error(`No home route at ${home}`);
  /** A route's parameters from the text of its segments, or null when its meta refuses one. */
  const accept = (route: RouteDefinition, found: readonly string[]): null | Values => {
    const params: Values = {};
    for (const [index, key] of route.keys.entries()) {
      let text: string;
      try {
        text = decodeURIComponent(found[index]!);
      } catch {
        return null;
      }
      const field = route.params[key] ?? { type: 'string' };
      const value = field.type === 'number' || field.type === 'integer' ? Number(text) : text;
      if (!text || text === '.' || text === '..' || /[/\\\u0000]/.test(text) || !valid(value, field)) return null;
      params[key] = value;
    }
    return params;
  };
  const match = (path: string) => {
    for (const route of definitions) {
      const native = patterns?.get(route)?.exec({ pathname: path.replace(/\/$/, '') });
      const found = patterns
        ? native && route.keys.map((key) => native.pathname.groups[key]!)
        : route.test.exec(path)?.slice(1);
      const params = found && accept(route, found);
      if (params) return { params, route };
    }
    return null;
  };
  const pathOf = (pattern: string, params: Values = {}) => {
    const route = byPath.get(pattern);
    if (!route) throw new Error(`Unknown route: ${pattern}`);
    if (Object.keys(params).some((key) => !route.keys.includes(key))) throw new Error(`Extra parameter for ${pattern}`);
    return pattern.replace(/:([A-Za-z_][\w]*)/g, (_, key: string) => {
      const value = params[key];
      if (
        !valid(value, route.params[key] ?? { type: 'string' }) ||
        String(value).length === 0 ||
        value === '.' ||
        value === '..' ||
        /[/\\\u0000]/.test(String(value))
      )
        throw new Error(`Invalid parameter ${key} for ${pattern}`);
      return encodeURIComponent(String(value));
    });
  };
  const format = (pattern: string, params: Values = {}, query: Record<string, unknown> = {}, hash = '') => {
    const route = byPath.get(pattern);
    if (!route) throw new Error(`Unknown route: ${pattern}`);
    const fields = { ...global, ...route.query };
    const values = clean(fields, query);
    const changed = Object.keys(values)
      .sort()
      .filter((key) => values[key] !== fields[key]?.default);
    const search = changed.length
      ? `?${new URLSearchParams({ query: JSON.stringify({ v: 1, ...Object.fromEntries(changed.map((key) => [key, values[key]])) }) })}`
      : '';
    return `${prefix}${pathOf(pattern, params).slice(1)}${search}${hash}`;
  };
  /** A route under the routes that own it, outermost first. */
  const chainOf = (selected: RouteDefinition) => {
    const chain: RouteDefinition[] = [];
    let parent: RouteDefinition | undefined = selected;
    while (parent) {
      chain.unshift(parent);
      parent = definitions.find((route) => route.folder === parent?.owner && !route.chart);
    }
    return chain;
  };
  /**
   * What an address keeps when it moves to `pattern`: the shell's fields, and those of the routes
   * both addresses are under. A field of the page left behind does not follow, whatever its name.
   */
  const carried = (from: AddressSnapshot, pattern: string): Values => {
    const route = byPath.get(pattern);
    if (!route) throw new Error(`Unknown route: ${pattern}`);
    let shared = global;
    for (const [depth, each] of chainOf(route).entries()) {
      if (from.chain[depth] !== each) break;
      shared = { ...global, ...each.query };
    }
    return Object.fromEntries(
      Object.keys(shared).flatMap((key) => (key in from.query ? [[key, from.query[key]!]] : [])),
    );
  };
  /** The snapshot of one matched route: its parameters, and the query read from `search`. */
  const snapshotOf = (selected: RouteDefinition, params: Values, search: string, hash: string): AddressSnapshot => {
    let query: Record<string, unknown> = {};
    try {
      const text = new URLSearchParams(search).get('query');
      const value: unknown = text && text.length <= 8192 ? JSON.parse(text) : {};
      // Version zero is the unversioned object. Unknown versions fall back to this schema's defaults.
      if (object(value) && (value['v'] === undefined || value['v'] === 0 || value['v'] === 1)) query = value;
    } catch {
      /* A broken link still opens the page with its defaults. */
    }
    const values = { ...defaults(all), ...clean({ ...global, ...selected.query }, query) };
    const chain = chainOf(selected);
    const path = pathOf(selected.path, params);
    const href = format(selected.path, params, values, hash);
    return {
      chain,
      hash,
      href,
      params,
      path,
      pattern: selected.path,
      query: values,
      route: { ...values, params, path, pattern: selected.path },
    };
  };
  const parse = (address: string): AddressSnapshot => {
    let url: URL;
    try {
      url = new URL(address, 'http://framework.local');
    } catch {
      url = new URL(format(home), 'http://framework.local');
    }
    const relative = url.pathname.startsWith(prefix) ? `/${url.pathname.slice(prefix.length)}` : '';
    const matched = match(relative) ?? { params: {}, route: homeRoute };
    return snapshotOf(matched.route, matched.params, url.search, url.hash);
  };
  /**
   * The same snapshot for a route a router matched: the pattern it names and the parameters it
   * read, as text. Parameters the route's meta refuses, or no pattern, give the home route.
   */
  const at = (pattern: string | undefined, raw: Record<string, string | undefined>, search: string, hash: string) => {
    const route = pattern === undefined ? undefined : byPath.get(pattern);
    const params = route && accept(route, route.keys.map((key) => raw[key] ?? ''));
    return route && params ? snapshotOf(route, params, search, hash) : snapshotOf(homeRoute, {}, search, hash);
  };
  const validateQuery = (pattern: string | undefined, changes: Record<string, unknown>) => {
    const fields = pattern === undefined ? global : { ...global, ...byPath.get(pattern)?.query };
    for (const [key, value] of Object.entries(changes))
      if (!fields[key] || !valid(value, fields[key])) throw new Error(`Invalid query field: ${key}`);
  };
  return { at, base: prefix, carried, definitions, format, global, home, match, parse, pathOf, validateQuery };
}
export type AddressCodec = ReturnType<typeof createCodec>;
export type AddressChange = { from: AddressSnapshot; to: AddressSnapshot; traversal: boolean };
/**
 * Who has a say in a change of address. Everyone is asked first, and being asked changes nothing.
 * Only when all agree is the address written; then each is told, and may move with it.
 */
export type Participant = { agrees(change: AddressChange): boolean; follows(change: AddressChange): void };
/** A chart's addresses: its route's path on screen, and the child segments its states name. */
export type ChartAddresses = { base: string; pattern: string; segments: readonly string[] };
export type AddressOptions = {
  browser?: Window;
  /** The hashes the app's shell shows a page for: a link to one is followed in place. Any other hash is the browser's. */
  hashes?: (hash: string) => boolean;
  initial?: string;
};
/** Where a History entry is among those one run of a store wrote. Two entries compare only within a run. */
type Entry = { at: number; run: string };

/** Which of a chart's addresses `at` is: null for its route's own, a segment, or undefined when it is elsewhere. */
export const heldAt = (own: ChartAddresses, at: AddressSnapshot) =>
  at.path === own.base ? null : own.segments.find((segment) => at.path === `${own.base}/${segment}`);

/** A store per document (or per story); no component owns a second copy of the address. */
export function createAddress(codec: AddressCodec, options: AddressOptions = {}) {
  const hashes = options.hashes ?? (() => false);
  let browser = options.browser;
  let snapshot = codec.parse(browser?.location.href ?? options.initial ?? codec.format(codec.home));
  let entry: Entry = { at: 0, run: '' };
  /** The entry a refused traversal is on its way back to: its own `popstate` is not a change. */
  let restoring: Entry | undefined;
  const listeners = new Set<() => void>();
  const participants = new Set<Participant>();
  const stamped = (): Entry | undefined => {
    const state: unknown = browser?.history.state;
    const found = object(state) ? state['frameworkAddress'] : undefined;
    return object(found) && typeof found['at'] === 'number' && typeof found['run'] === 'string'
      ? { at: found['at'], run: found['run'] }
      : undefined;
  };
  const stamp = () => {
    const state: unknown = browser?.history.state;
    return { ...(object(state) ? state : {}), frameworkAddress: entry };
  };
  const show = (next: AddressSnapshot) => {
    const kept =
      Object.keys(snapshot.params).length === Object.keys(next.params).length &&
      Object.keys(next.params).every((key) => next.params[key] === snapshot.params[key]);
    snapshot = kept ? { ...next, params: snapshot.params, route: { ...next.route, params: snapshot.params } } : next;
  };
  const tell = () => {
    for (const listener of listeners) listener();
  };
  const write = (next: AddressSnapshot, replace: boolean) => {
    if (!replace) entry = { at: entry.at + 1, run: entry.run };
    browser?.history[replace ? 'replaceState' : 'pushState'](stamp(), '', next.href);
  };
  const agreed = (change: AddressChange) => [...participants].every((each) => each.agrees(change));
  // The address is the new one before anyone is told, so what a participant then says of its own
  // address (a chart entering the state asked for) finds it already there, and writes nothing.
  const adopt = (change: AddressChange) => {
    show(change.to);
    for (const each of [...participants]) each.follows(change);
    tell();
  };
  const navigate = (href: string, replace = false) => {
    const change = { from: snapshot, to: codec.parse(href), traversal: false };
    if (change.to.href === snapshot.href || !agreed(change)) return;
    write(change.to, replace);
    adopt(change);
  };
  const href = (pattern: string, params: Values = {}, query: Record<string, unknown> = {}) => {
    codec.validateQuery(pattern, query);
    return codec.format(pattern, params, { ...codec.carried(snapshot, pattern), ...query });
  };
  const navigation = {
    go: (pattern: string, params: Values = {}, query: Values = {}) => navigate(href(pattern, params, query)),
    href,
    query: (pattern: string | Values, changes?: Values) => {
      const scope = typeof pattern === 'string' ? pattern : undefined;
      const patch = typeof pattern === 'string' ? (changes ?? {}) : pattern;
      if (scope && !snapshot.chain.some((route) => route.path === scope))
        throw new Error(`Query scope ${scope} is not active`);
      codec.validateQuery(scope, patch);
      navigate(codec.format(snapshot.pattern, snapshot.params, { ...snapshot.query, ...patch }, snapshot.hash));
    },
  };
  // Back, Forward and a change of hash: the browser has already moved.
  const follow = () => {
    const landed = stamped();
    if (restoring && landed?.run === restoring.run && landed.at === restoring.at) {
      restoring = undefined;
      return;
    }
    const change = { from: snapshot, to: codec.parse(browser!.location.href), traversal: true };
    const moved = change.to.href !== snapshot.href;
    if (moved && !agreed(change)) {
      // Refused: back to the entry left, when this one says how far that is; an entry that does
      // not (another run's, or one the browser added) takes the address on screen instead.
      if (landed?.run === entry.run && landed.at !== entry.at) {
        restoring = entry;
        browser!.history.go(entry.at - landed.at);
      } else browser!.history.replaceState(stamp(), '', snapshot.href);
      return;
    }
    // An entry nobody stamped is one the browser has just added, for a link to a hash.
    entry = landed ?? { at: entry.at + 1, run: entry.run };
    browser!.history.replaceState(stamp(), '', change.to.href);
    if (moved) adopt(change);
  };
  /** Follows a link in place when it is to an address of the app; false for one that is the browser's. */
  const open = (link: string) => {
    const here = browser?.location ?? globalThis.location;
    const url = new URL(link, here.href);
    if (url.origin !== here.origin || !url.pathname.startsWith(codec.base)) return false;
    if (url.hash ? !hashes(url.hash) : !codec.match(`/${url.pathname.slice(codec.base.length)}`)) return false;
    navigate(url.href);
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
    /**
     * A chart says which of its addresses its state is. Entering a state that names a segment adds
     * an entry; coming back to the route's own address replaces the entry, so Back never returns
     * to a state the chart has left. Nothing is written while the address is not one of the chart's.
     */
    hold: (own: ChartAddresses, segment: null | string) => {
      const held = heldAt(own, snapshot);
      if (held === undefined || held === segment) return;
      const pattern = segment === null ? own.pattern : `${own.pattern}/${segment}`;
      const next = codec.parse(codec.format(pattern, snapshot.params, snapshot.query));
      write(next, segment === null);
      show(next);
      tell();
    },
    listen: (host = browser) => {
      browser = host;
      if (host) {
        snapshot = codec.parse(host.location.href);
        // A reload, a duplicated tab or a page restored keeps the entry's place among its neighbours.
        entry = stamped() ?? { at: 0, run: `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}` };
        host.history.replaceState(stamp(), '', snapshot.href);
        host.addEventListener('popstate', follow);
        host.addEventListener('hashchange', follow);
      }
      const document = host?.document ?? globalThis.document;
      document?.addEventListener('click', click);
      return () => {
        host?.removeEventListener('popstate', follow);
        host?.removeEventListener('hashchange', follow);
        document?.removeEventListener('click', click);
      };
    },
    navigation,
    /**
     * For links whose clicks never reach the document (a component library that handles them
     * itself, and hands the address to a function): what a click on a plain link does.
     */
    open,
    permit: (participant: Participant) => {
      participants.add(participant);
      return () => {
        participants.delete(participant);
      };
    },
    replace: (href: string) => navigate(href, true),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type Address = ReturnType<typeof createAddress>;

/** Parameters come from the pattern; a route's meta may refine a named parameter. */
export type ParameterNames<Path extends string> = Path extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParameterNames<Rest>
  : Path extends `${string}:${infer Name}`
    ? Name
    : never;
export type ParametersOf<Path extends string, Declared = object> = {
  [Key in ParameterNames<Path>]: Key extends keyof Declared ? Declared[Key] : string;
};
type Exact<Value, Shape> = Record<Exclude<keyof Value, keyof Shape>, never> & Value;
type Catalogue<Routes> = Record<keyof Routes, { params: object; query: object }>;
type Arguments<
  Path extends string,
  Entry extends { params: object; query: object },
  Params extends ParametersOf<Path, Entry['params']>,
  Query extends Partial<Entry['query']>,
> = [ParameterNames<Path>] extends [never]
  ? [params?: Record<string, never>, query?: Exact<Query, Partial<Entry['query']>>]
  : [params: Exact<Params, ParametersOf<Path, Entry['params']>>, query?: Exact<Query, Partial<Entry['query']>>];
export type TypedNavigation<Routes extends Catalogue<Routes>, Global extends object> = {
  go<
    Path extends keyof Routes & string,
    Params extends ParametersOf<Path, Routes[Path]['params']>,
    Query extends Partial<Routes[Path]['query']>,
  >(
    pattern: Path,
    ...args: Arguments<Path, Routes[Path], Params, Query>
  ): void;
  href<
    Path extends keyof Routes & string,
    Params extends ParametersOf<Path, Routes[Path]['params']>,
    Query extends Partial<Routes[Path]['query']>,
  >(
    pattern: Path,
    ...args: Arguments<Path, Routes[Path], Params, Query>
  ): string;
  query<Changes extends Partial<Global>>(changes: Exact<Changes, Partial<Global>>): void;
  query<Path extends keyof Routes & string, Changes extends Partial<Routes[Path]['query']>>(
    pattern: Path,
    changes: Exact<Changes, Partial<Routes[Path]['query']>>,
  ): void;
};
