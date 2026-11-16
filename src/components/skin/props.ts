import type { Skin } from '@/skins';

export type Props = { skin: Skin };
// The skin switch: every skin the app wears, by its name. The page's markup is the same in all of
// them; each skin is another sheet for every component folder.

import { SKINS } from '@/skins';

export default ({ i18n, skin }) => ({
  label: i18n.label,
  options: SKINS.map((id) => ({ id, name: i18n.names[id] })),
  skin,
});

export const examples = { 'The switch': { props: { skin: 'default' } } };
