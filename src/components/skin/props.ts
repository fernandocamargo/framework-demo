// The skin switch: every skin the app wears, by its name. The page's markup is the same in all of
// them; each skin is another sheet for every component folder.

import { currentSkin, SKINS } from '@/skins';

export default ({ i18n }) => ({
  label: i18n.label,
  options: SKINS.map((id) => ({ id, name: i18n.names[id] })),
  skin: currentSkin(),
});
