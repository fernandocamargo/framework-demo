import type { Key } from 'react-aria-components';

import { type Skin, wear } from '@/skins';

export const wearSkin = () => (key: Key | null) => wear(key as Skin);
