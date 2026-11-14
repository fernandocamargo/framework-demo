import { SKINS } from './skins';

// A component folder with a default sheet has a sheet for every skin: a folder without one shows
// unstyled in that skin. Only the paths of the sheets are read here, never the sheets themselves.
const sheets = Object.keys(import.meta.glob('./components/**/style/skins/*/index.ts'));
const sheet = /^(.+)\/style\/skins\/([^/]+)\/index\.ts$/;

test('every component folder with a default sheet has a sheet for every skin', () => {
  const skinsByFolder = new Map<string, Set<string>>();
  for (const path of sheets) {
    const match = sheet.exec(path);
    if (!match) continue;
    const folder = match[1] ?? '';
    const skin = match[2] ?? '';
    skinsByFolder.set(folder, (skinsByFolder.get(folder) ?? new Set()).add(skin));
  }

  const missing: string[] = [];
  for (const [folder, skins] of skinsByFolder) {
    if (!skins.has('default')) continue;
    for (const skin of SKINS) {
      if (!skins.has(skin)) missing.push(`${folder}: no sheet for the "${skin}" skin`);
    }
  }
  expect(missing, 'folders with a default sheet and no sheet for a skin').toEqual([]);
});
