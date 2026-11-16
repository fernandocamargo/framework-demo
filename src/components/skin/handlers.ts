import type { Key } from 'react-aria-components';

import { SKINS, wear } from '@/skins';

export const wearSkin =
  ({ navigation }) =>
  (key: Key | null) => {
    const skin = SKINS.find((value) => value === key);

    if (skin) wear(navigation, skin);
  };
