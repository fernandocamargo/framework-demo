import path from 'node:path';

import routes from '../shared/routes.cjs';

export const { routeTypes, scanRoutes } = routes;

export function addressModule(scan, runtime, base) {
  const beside = (file) => JSON.stringify(path.join(path.dirname(JSON.parse(runtime)), file));
  return [
    `import { createCodec } from ${beside('address.ts')};`,
    `export const codec = createCodec(${JSON.stringify(scan.routes, null, 1)}, ${JSON.stringify(scan.global)}, ${JSON.stringify(scan.home)}, ${JSON.stringify(base)});`,
    `export { useNavigation, useRoute } from ${beside('routing.tsx')};`,
    'export default codec;',
  ].join('\n');
}

/** Each folder owns one Routes element, containing only its direct children. */
export function routesModule(scan, root, owner) {
  const parent = scan.routes.find((route) => route.folder === owner);
  const children = scan.routes.filter((route) => route.owner === owner);

  return {
    element: `createElement(Routes, null, ${children
      .map((route, index) => {
        const segment = route.path.slice(parent ? parent.path.length + 1 : 1);

        const match = route.index
          ? 'index: true'
          : `path: ${JSON.stringify(segment + (scan.routes.some((child) => child.owner === route.folder) ? '/*' : ''))}`;

        return `createElement(Route, { ${match}, element: bound(createElement(Route${index})) })`;
      })
      .join(', ')})`,
    imports: children.map(
      (route, index) =>
        `import Route${index} from ${JSON.stringify('\0framework-component:' + path.join(root, route.folder))};`,
    ),
  };
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
