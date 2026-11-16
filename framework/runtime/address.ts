import { matchPath } from 'react-router';

/**
 * The generated schema of the app's addresses: typed parameters and one canonical JSON `query`.
 * React Router matches paths and keeps History; this file validates parameters and query fields.
 */
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
  folder: string;
  index?: boolean;
  keys: string[];
  owner: string;
  params: Fields;
  path: string;
  query: Fields;
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
      parent = definitions.find((route) => route.folder === parent?.owner);
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
  /**
   * The snapshot of the route the router matched: the pattern it names and the parameters it
   * read, as text. Parameters the route's meta refuses, or no pattern, give the home route.
   */
  const at = (pattern: string | undefined, raw: Record<string, string | undefined>, search: string, hash: string) => {
    const route = pattern === undefined ? undefined : byPath.get(pattern);
    const params =
      route &&
      accept(
        route,
        route.keys.map((key) => raw[key] ?? ''),
      );
    return route && params ? snapshotOf(route, params, search, hash) : snapshotOf(homeRoute, {}, search, hash);
  };
  const validateQuery = (pattern: string | undefined, changes: Record<string, unknown>) => {
    const fields = pattern === undefined ? global : { ...global, ...byPath.get(pattern)?.query };
    for (const [key, value] of Object.entries(changes))
      if (!fields[key] || !valid(value, fields[key])) throw new Error(`Invalid query field: ${key}`);
  };

  const read = (pathname: string, search = '', hash = '') => {
    for (const route of definitions) {
      const match = matchPath(route.path, pathname);

      if (match) return at(route.path, match.params, search, hash);
    }

    return at(undefined, {}, search, hash);
  };

  return { at, base: prefix, carried, definitions, format, global, home, pathOf, read, validateQuery };
}

export type AddressCodec = ReturnType<typeof createCodec>;
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
  query<Changes extends Partial<Global>>(
    changes: Exact<Changes, Partial<Global>>,
    options?: { replace: boolean },
  ): void;
  query<Path extends keyof Routes & string, Changes extends Partial<Routes[Path]['query']>>(
    pattern: Path,
    changes: Exact<Changes, Partial<Routes[Path]['query']>>,
  ): void;
  replace: TypedNavigation<Routes, Global>['go'];
};
