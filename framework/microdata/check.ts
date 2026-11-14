// The page names what its pieces are with microdata from schema.org: an item is an element with
// `itemscope` and an `itemtype`, and each of its pieces names its place in it with `itemprop`. This
// says what is wrong with that naming under `root`, against one release of schema.org
// (vocabulary.json): a type or a property schema.org does not have (or has only as pending or
// superseded), a property the item's type does not take, a property outside any item, an item
// given to a property that takes no item of its type, or an enumeration value the property does
// not take. Nothing else names a piece of a component, so this is also what keeps those names
// about what a piece is, not how it looks.
//
// The function has no imports and reads nothing around it, so a page can run it as it is
// (`page.evaluate(checkMicrodata, vocabulary)` in the end-to-end flows).

export type Vocabulary = {
  members: Record<string, string>;
  pending: string[];
  properties: Record<string, { domains: string[]; ranges: string[] }>;
  superseded: string[];
  types: Record<string, string[]>;
  version: string;
};

/** What is wrong with the microdata under `root`, one line each; nothing when it is right. */
export function checkMicrodata(vocabulary: Vocabulary, root: ParentNode = document): string[] {
  const SCHEMA = 'https://schema.org/';
  const problems: string[] = [];
  const pending = new Set(vocabulary.pending);
  const superseded = new Set(vocabulary.superseded);
  const tokens = (value: null | string) => (value ?? '').split(/\s+/).filter(Boolean);
  const where = (element: Element) => {
    const attributes = Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith('item'))
      .map((attribute) => (attribute.value ? `${attribute.name}="${attribute.value}"` : attribute.name));
    const label = element.closest('[aria-label]')?.getAttribute('aria-label');
    return `<${element.tagName.toLowerCase()} ${attributes.join(' ')}>${label ? ` in "${label}"` : ''}`;
  };
  /** A type with every type it is a kind of, `Thing` included. */
  const lineage = (type: string) => {
    const seen = new Set<string>();
    const visit = (name: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      for (const parent of vocabulary.types[name] ?? []) visit(parent);
    };
    visit(type);
    return seen;
  };
  const typesOf = (element: Element) =>
    tokens(element.getAttribute('itemtype'))
      .filter((url) => url.startsWith(SCHEMA))
      .map((url) => url.slice(SCHEMA.length));
  const status = (name: string) =>
    pending.has(name) ? ' is only pending in schema.org' : superseded.has(name) ? ' is superseded in schema.org' : '';

  for (const element of Array.from(root.querySelectorAll('[itemtype]'))) {
    if (!element.hasAttribute('itemscope')) problems.push(`${where(element)}: an itemtype needs itemscope`);
    for (const url of tokens(element.getAttribute('itemtype'))) {
      const name = url.startsWith(SCHEMA) ? url.slice(SCHEMA.length) : null;
      if (name === null) problems.push(`${where(element)}: ${url} is not a schema.org type`);
      else if (!vocabulary.types[name]) problems.push(`${where(element)}: schema.org has no type ${name}`);
      else if (status(name)) problems.push(`${where(element)}: ${name}${status(name)}`);
    }
  }

  for (const element of Array.from(root.querySelectorAll('[itemprop]'))) {
    const item = element.parentElement?.closest('[itemscope]');
    if (!item) {
      problems.push(`${where(element)}: a property outside any item`);
      continue;
    }
    const itemTypes = typesOf(item);
    const takes = new Set(itemTypes.flatMap((type) => [...lineage(type)]));
    for (const name of tokens(element.getAttribute('itemprop'))) {
      const property = vocabulary.properties[name];
      if (!property) {
        problems.push(`${where(element)}: schema.org has no property ${name}`);
        continue;
      }
      if (status(name)) problems.push(`${where(element)}: ${name}${status(name)}`);
      if (itemTypes.length && !property.domains.some((domain) => takes.has(domain)))
        problems.push(`${where(element)}: ${itemTypes.join(', ')} takes no ${name}`);
      // An item as the value: its type, or one it is a kind of, is one the property takes.
      const valueTypes = element.hasAttribute('itemscope') ? typesOf(element) : [];
      if (valueTypes.length && !valueTypes.some((type) => property.ranges.some((range) => lineage(type).has(range))))
        problems.push(`${where(element)}: ${name} takes no ${valueTypes.join(', ')}`);
      // An enumeration's value, linked: a member of a type the property takes.
      const href = element.getAttribute('href');
      if (href?.startsWith(SCHEMA)) {
        const member = href.slice(SCHEMA.length);
        const enumeration = vocabulary.members[member];
        if (!enumeration) problems.push(`${where(element)}: schema.org has no value ${member}`);
        else if (!property.ranges.some((range) => lineage(enumeration).has(range)))
          problems.push(`${where(element)}: ${name} takes no ${enumeration} (${member})`);
      }
      if (element.tagName === 'META' && !element.hasAttribute('content'))
        problems.push(`${where(element)}: a meta property needs content`);
    }
  }
  return problems;
}
