import path from 'node:path';

import routes from '../shared/routes.cjs';

export const { routeTypes, scanRoutes } = routes;

export function addressModule(scan, runtime, base) {
  const beside = (file) => JSON.stringify(path.join(path.dirname(JSON.parse(runtime)), file));
  return [
    `import { createCodec } from ${beside('address.ts')};`,
    `import { createRouterAddress } from ${beside('router.tsx')};`,
    `export const codec = createCodec(${JSON.stringify(scan.routes, null, 1)}, ${JSON.stringify(scan.global)}, ${JSON.stringify(scan.home)}, ${JSON.stringify(base)});`,
    '/** The address of a document, on the React Router router given. */',
    'export const createAddress = (router, options) => createRouterAddress(codec, router, options);',
    'export default codec;',
  ].join('\n');
}

/** The pattern of the route whose chart a component's is, when its states name addresses. */
export const routedBy = (scan, component) => {
  const state = scan.routes.find((route) => route.chart?.component === component);
  return state && scan.routes.find((route) => route.folder === state.owner && !route.chart)?.path;
};

/**
 * The route objects of React Router's data router, one per route folder, nested as the folders
 * are. Each loads its folder when it first matches, and starts the folder's view and skin with it.
 * A state of a chart that names a segment is a child route with nothing to render: the chart shows it.
 */
export function routesModule(scan, root, runtime) {
  const router = JSON.stringify(path.join(path.dirname(JSON.parse(runtime)), 'router.tsx'));
  const relative = (route, parent) => route.path.slice(parent ? parent.path.length + 1 : 1);
  const objects = (owner, parent, indent) =>
    scan.routes
      .filter((route) => route.owner === owner)
      .map((route) => {
        const fields = [
          `id: ${JSON.stringify(route.folder)}`,
          `path: ${JSON.stringify(relative(route, parent))}`,
          `handle: { pattern: ${JSON.stringify(route.path)} }`,
        ];
        if (!route.chart) {
          fields.push(
            `lazy: folder(() => import(${JSON.stringify('\0framework-component:' + path.join(root, route.folder))}), ${JSON.stringify(route.path)})`,
          );
          if (route.keys.length) fields.push(`loader: guarded(codec, ${JSON.stringify(route.path)})`);
          const children = objects(route.folder, route, `${indent}  `);
          if (children.length) fields.push(`children: [\n${children.join(',\n')},\n${indent}]`);
        }
        return `${indent}  { ${fields.join(', ')} }`;
      });
  const owners = new Set(scan.routes.map((route) => route.owner));
  const folders = new Set(scan.routes.map((route) => route.folder));
  const top = [...owners].filter((owner) => !folders.has(owner));
  return [
    `import { guarded, routed } from ${router};`,
    "import codec from 'virtual:framework/address';",
    'const folder = (load, pattern) => () =>',
    '  load().then((module) => {',
    '    module.default.preload?.();',
    '    return { Component: routed(module.default, pattern) };',
    '  });',
    `export const home = ${JSON.stringify(scan.home)};`,
    'export default [',
    `${top.flatMap((owner) => objects(owner, undefined, '')).join(',\n')},`,
    '];',
  ].join('\n');
}

/** Static pages need no rewrite. The dynamic fallback is emitted separately for an explicit hosting choice. */
export function staticPages(scan, html) {
  return [
    ...scan.routes
      .filter((route) => !route.keys.length)
      .map((route) => ({ fileName: `${route.path.slice(1)}/index.html`, source: html })),
    {
      fileName: 'routing-fallback/404.html',
      source: `<!-- Optional History fallback for dynamic paths: copy to 404.html only when deploying with this fallback. -->\n${html}`,
    },
  ];
}
