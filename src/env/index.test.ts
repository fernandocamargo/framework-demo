const original = window.location.href;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_WORLD', 'dummyjson');
  vi.stubEnv('VITE_GROWTHBOOK_CLIENT_KEY', 'flags-key');
  vi.stubEnv('VITE_MAPTILER_KEY', 'maps-key');
});

afterEach(() => {
  window.history.replaceState(null, '', original);
  vi.unstubAllEnvs();
});

test.each([
  ['/products', 'dummyjson', 'dummyjson'],
  ['/products?query={"v":1,"world":"memory"}', 'dummyjson', 'memory'],
  ['/products?query={"v":1,"world":"dummyjson"}', 'memory', 'memory'],
  ['/?world=memory#/products?edit=4', 'dummyjson', 'memory'],
])('the first address %s and VITE_WORLD=%s define the environment', async (href, buildWorld, world) => {
  window.history.replaceState(null, '', href);
  vi.stubEnv('VITE_WORLD', buildWorld);
  const { default: env } = await import('./index');

  expect(env).toEqual({ apiUrl: 'https://dummyjson.com', flagsKey: 'flags-key', mapsKey: 'maps-key', world });
  expect(window.location.href).toBe(new URL(href, original).href);
  window.history.replaceState(null, '', '/products?query={"v":1,"world":"dummyjson"}');
  expect((await import('./index')).default).toBe(env);
});
