import { type Skin, wear } from '@/skins';

export const wearSkin = () => (event: React.ChangeEvent<HTMLSelectElement>) =>
  // SAFETY: The select's options are the supported SKINS.
  wear(event.currentTarget.value as Skin);
