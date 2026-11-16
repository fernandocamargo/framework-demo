// The page's skin lives in the generated query and travels with every link.
import { address, inPlace } from './address';

export const SKINS = ['default', 'broadsheet', 'blueprint'] as const;
export type Skin = (typeof SKINS)[number];

/** The skin the address asks for, or the default one. */
export const currentSkin = (asked = address.getSnapshot().query['skin'] as string): Skin => {
  return SKINS.find((skin) => skin === asked) ?? 'default';
};

/** Shows the page in another skin: the address changes in place, and the shell follows. */
export const wear = (skin: Skin) => inPlace({ skin });
