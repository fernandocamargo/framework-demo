/**
 * What the framework injects: the environment, the selected entity, the clients, the services
 * and a URL helper. Root wires the services around the clients the plugin composed.
 * Every service operation runs through the data layer (data.ts).
 */

import serviceModules from 'virtual:framework/services';

import { type DataLayer, name, type ServiceRule } from './data';
import type { Entity, Env } from './index';
import type { Injection, Url } from './types';

export type { Injection };

// The runtime builds the trees without knowing their shape; the TypeScript plugin types them
// for authors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tree = any;

/** A folder name as a property name: `socket.io` → `socketIo`, `single-file` → `singleFile`. */
export const camelCase = (segment: string) =>
  segment
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word.charAt(0).toLowerCase() : word.charAt(0).toUpperCase()) + word.slice(1))
    .join('');

const lazy = <T>(create: () => T) => {
  let created = false;
  let value: T;
  return () => {
    if (!created) {
      value = create();
      created = true;
    }
    return value;
  };
};

/**
 * `services.a.b.c.d.e(…)` for a folder's default export, `services.singleFile.fetchSomething(…)`
 * for its named exports. Each export receives the injection, `services` included, once, on
 * first use, and returns the operation. A folder with a default export and
 * subfolders is callable and has properties.
 */
export function createServices(base: Omit<Injection, 'services'>, data: DataLayer): Tree {
  const root: Record<string, unknown> = {};
  const injection: Injection = { ...base, services: root };
  const callable = new Set(
    serviceModules
      .filter(({ module }) => typeof module['default'] === 'function')
      .map(({ segments }) => segments.map(camelCase).join('.')),
  );

  const nodeAt = (keys: string[], create: (key: string) => unknown) => {
    let node = root as Record<string, unknown>;
    keys.forEach((key, index) => {
      if (!(key in node))
        Object.defineProperty(node, key, { enumerable: true, value: create(keys.slice(0, index + 1).join('.')) });
      node = node[key] as Record<string, unknown>;
    });
    return node;
  };

  const operations = new Map<string, () => (...args: unknown[]) => unknown>();
  const operation = (key: string, factory: unknown) => {
    if (typeof factory !== 'function') throw new Error(`services.${key} is not a function of the injection`);
    operations.set(
      key,
      lazy(() => factory(injection)),
    );
  };
  // Each operation is named by its path, so `meta.ts` can refer to it, and runs through the data layer.
  const run = (key: string) => {
    const operation = (...args: unknown[]) => {
      const get = operations.get(key);
      if (!get) throw new Error(`services.${key} has no operation`);
      readRules();
      return data.call(key, get(), args);
    };
    name(operation, key);
    return operation;
  };

  // A folder's `meta.ts` says which operations read and what writes make stale. It refers to
  // operations by reference, so it is read once the tree exists, on first use.
  let rulesRead = false;
  const readRules = () => {
    if (rulesRead) return;
    rulesRead = true;
    for (const { meta, segments } of serviceModules) {
      if (typeof meta?.default !== 'function') continue;
      const path = segments.map(camelCase).join('.');
      const rules = meta.default(injection) as Record<string, ServiceRule>;
      for (const [exported, rule] of Object.entries(rules))
        data.rule(exported === 'default' ? path : `${path}.${exported}`, rule);
    }
  };

  for (const { module, segments } of serviceModules) {
    const keys = segments.map(camelCase);
    const path = keys.join('.');
    const node = nodeAt(keys, (key) => (callable.has(key) ? run(key) : {}));
    if (typeof module['default'] === 'function') operation(path, module['default']);
    for (const [name, factory] of Object.entries(module)) {
      if (name === 'default') continue;
      const key = `${path}.${name}`;
      operation(key, factory);
      Object.defineProperty(node, name, { enumerable: true, value: run(key) });
    }
  }

  return root;
}

export const createUrl = (): Url => ({
  params: {
    merge: (extra) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
      return params;
    },
  },
});

export function createInjection(clients: Tree, env: Env, entity: Entity, data: DataLayer): Injection {
  const url = createUrl();
  const services = createServices({ clients, entity, env, url }, data);
  return { clients, entity, env, services, url };
}
