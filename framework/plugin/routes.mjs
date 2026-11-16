import path from 'node:path';

import routes from '../shared/routes.cjs';

export const { routeTypes, scanRoutes } = routes;

export function addressModule(scan, runtime, base) {
  const definitions = scan.routes.map(
    ({ test, ...route }) => `{ ...${JSON.stringify(route)}, test: new RegExp(${JSON.stringify(test)}) }`,
  );
  return [
    `import { createCodec } from ${JSON.stringify(path.join(path.dirname(JSON.parse(runtime)), 'address.ts'))};`,
    `export { createAddress } from ${JSON.stringify(path.join(path.dirname(JSON.parse(runtime)), 'address.ts'))};`,
    `export const codec = createCodec([${definitions.join(',\n')}], ${JSON.stringify(scan.global)}, ${JSON.stringify(scan.home)}, ${JSON.stringify(base)});`,
    'export default codec;',
  ].join('\n');
}

export function routesModule(scan, root) {
  return [
    "import { lazy } from 'react';",
    'export default {',
    ...scan.routes
      .filter((route) => !route.chart)
      .map(
        (route) =>
          `${JSON.stringify(route.folder)}: lazy(() => import(${JSON.stringify('\0framework-component:' + path.join(root, route.folder))})),`,
      ),
    '};',
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
