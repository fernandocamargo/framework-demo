import { SKINS, wear } from '@/skins';

export const wearSkin =
  ({ navigation }) =>
  (event: React.ChangeEvent<HTMLSelectElement>) => {
    const skin = SKINS.find((value) => value === event.currentTarget.value);

    if (skin) wear(navigation, skin);
  };
