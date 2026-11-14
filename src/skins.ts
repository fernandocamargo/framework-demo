// The skins the app wears, and the part of the address that says which one shows: `?skin=broadsheet`,
// before the hash, beside `?lang=` and `?world=`, so every link inside the app keeps it. Every
// component folder has a sheet for each (style/skins/<name>/index.ts); the markup is the same in all.
export const SKINS = ['default', 'broadsheet'] as const;
export type Skin = (typeof SKINS)[number];

/** The skin the address asks for, or the default one. */
export const currentSkin = (): Skin => {
  const asked = new URLSearchParams(window.location.search).get('skin');
  return SKINS.find((skin) => skin === asked) ?? 'default';
};

/** Shows the page in another skin: the address changes in place, and the shell follows. */
export const wear = (skin: Skin) => {
  const url = new URL(window.location.href);
  if (skin === 'default') url.searchParams.delete('skin');
  else url.searchParams.set('skin', skin);
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event('skinchange'));
};
