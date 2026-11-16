import type { GlobalQuery, RoutePatterns } from '../../../.framework-types/src/routes';
import type { Navigation, ParametersOf, RouteRead, TypedNavigation } from '../index';

declare const navigation: Navigation;
const generated: TypedNavigation<RoutePatterns, GlobalQuery> = navigation;
void generated;
navigation.go('/products/:id/edit', { id: 4 });
navigation.go('/products/bulk/confirm');
navigation.query('/products', { page: 2 });
navigation.query({ signin: true });
// @ts-expect-error Only patterns discovered in route folders are addresses.
navigation.go('/not-a-route');
// @ts-expect-error The pattern requires its id.
navigation.go('/products/:id/edit');
// @ts-expect-error This route's meta declares a numeric id.
navigation.go('/products/:id/edit', { id: '4' });
// @ts-expect-error A parameter cannot name something outside the pattern.
navigation.go('/products/:id/edit', { id: 4, slug: 'lamp' });
const extra = { id: 4, slug: 'lamp' };
// @ts-expect-error Extra parameters are refused even when passed through a variable.
navigation.go('/products/:id/edit', extra);
// @ts-expect-error A static pattern takes no parameters.
navigation.go('/products', { id: 4 });
// @ts-expect-error A region belongs to the orders route's query slice.
navigation.query('/products', { region: 'TX' });
// @ts-expect-error Page numbers are numbers in JSON.
navigation.query('/products', { page: '2' });
// @ts-expect-error An unscoped query patch names only shell fields.
navigation.query({ page: 2 });
const named: ParametersOf<'/people/:name'> = { name: 'Ada' };
void named;

// The third argument takes the destination's query fields, and no other, also through a variable.
navigation.go('/products', {}, { page: 2, q: 'lamp' });
const mixed = { page: 2, region: 'TX' };
// @ts-expect-error A field of another route's slice is refused even when a valid one comes with it.
navigation.go('/products', {}, mixed);
// @ts-expect-error The same for a link.
navigation.href('/products/:id', { id: 4 }, mixed);

// A route is read under its pattern: the parameters it names are there, and no other.
declare const route: RouteRead;
const maybe: number | undefined = route.params.id;
void maybe;
if (route.pattern === '/products/:id/edit') {
  const id: number = route.params.id;
  void id;
}
if (route.pattern === '/products/new') {
  // @ts-expect-error This pattern names no parameter.
  const id: number = route.params.id;
  void id;
}
// @ts-expect-error Outside its pattern, a parameter may be missing.
const always: number = route.params.id;
void always;
