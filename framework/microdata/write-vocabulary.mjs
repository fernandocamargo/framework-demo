// Writes vocabulary.json: schema.org's types, properties and enumeration members, from one pinned
// release, as much of it as the microdata check needs (check.ts). Run it again to move to another
// release: `node framework/microdata/write-vocabulary.mjs`.

import { writeFileSync } from 'node:fs';

const VERSION = '30.1';
const SOURCE = `https://schema.org/version/${VERSION}/schemaorg-current-https.jsonld`;

const graph = (await (await fetch(SOURCE)).json())['@graph'];
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const ids = (value) =>
  list(value)
    .map((node) => node['@id'])
    .filter((id) => id.startsWith('schema:'))
    .map((id) => id.slice('schema:'.length));

const types = {};
const properties = {};
const members = {};
const pending = [];
const superseded = [];
for (const node of graph) {
  const name = node['@id'].slice('schema:'.length);
  const kinds = list(node['@type']);
  if (list(node['schema:isPartOf']).some((part) => part['@id'].includes('pending'))) pending.push(name);
  if (node['schema:supersededBy']) superseded.push(name);
  if (kinds.includes('rdfs:Class')) types[name] = ids(node['rdfs:subClassOf']);
  else if (kinds.includes('rdf:Property'))
    properties[name] = { domains: ids(node['schema:domainIncludes']), ranges: ids(node['schema:rangeIncludes']) };
  else {
    const enumeration = kinds.find((kind) => kind.startsWith('schema:'));
    if (enumeration) members[name] = enumeration.slice('schema:'.length);
  }
}

const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  new URL('./vocabulary.json', import.meta.url),
  `${JSON.stringify({
    members: sorted(members),
    pending: pending.sort(),
    properties: sorted(properties),
    source: SOURCE,
    superseded: superseded.sort(),
    types: sorted(types),
    version: VERSION,
  })}\n`,
);
console.log(
  `schema.org ${VERSION}: ${Object.keys(types).length} types, ${Object.keys(properties).length} properties, ${Object.keys(members).length} members`,
);
