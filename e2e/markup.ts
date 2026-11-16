/** Skin is address data in every link; only that field is normalised when comparing the markup. */
export function markupWithoutLinkSkin(element: Element) {
  const copy = element.cloneNode(true) as Element;
  for (const link of Array.from(copy.querySelectorAll('a[href]'))) {
    const url = new URL(link.getAttribute('href')!, window.location.href);
    const text = url.searchParams.get('query');
    if (url.origin !== window.location.origin || !text) continue;
    const query = JSON.parse(text) as Record<string, unknown>;
    delete query['skin'];
    if (Object.keys(query).some((key) => key !== 'v')) url.searchParams.set('query', JSON.stringify(query));
    else url.searchParams.delete('query');
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  }
  // Attribute insertion order can differ between navigation and a fresh mount.
  for (const element of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
    const attributes = Array.from(element.attributes).sort((a, b) => a.name.localeCompare(b.name));
    for (const attribute of attributes) element.removeAttribute(attribute.name);
    for (const attribute of attributes) element.setAttribute(attribute.name, attribute.value);
  }
  return copy.outerHTML;
}
