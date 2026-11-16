// Browser visits use the public address format, independently of the app's codec.
export function visit(path = '/products', query = {}) {
  const values = { ...query, world: 'memory' };
  const ordered = Object.fromEntries(
    Object.keys(values)
      .sort()
      .map((key) => [key, values[key]]),
  );
  return `${path}?${new URLSearchParams({ query: JSON.stringify({ v: 1, ...ordered }) })}`;
}

/** @returns {Record<string, boolean | number | string>} */
export function queryOf(url) {
  return JSON.parse(new URL(url).searchParams.get('query') ?? '{}');
}

/**
 * Opens an address in the document that is already there, as a new hash did before the routes: the
 * page is not loaded again, so what it holds (the lab's faults, the cache, a session) stays.
 */
export const moveTo = (page, href) =>
  page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, href);

/**
 * What `page.goto` did with a hash address. The world, the language and the skin were in the search:
 * an address that changed one of them loaded a document, and any other changed the hash in place.
 */
export function arrive(page, path = '/products', query = {}, base = '') {
  const href = `${base}${visit(path, query)}`;
  const from = page.url();
  const inPlace =
    from.startsWith('http') &&
    ['lang', 'skin', 'world'].every((key) => queryOf(from)[key] === queryOf(new URL(href, from).href)[key]);
  return inPlace ? moveTo(page, href) : page.goto(href);
}
