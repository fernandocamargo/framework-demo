import type { Key } from 'react-aria-components';

import { type Locale, speak } from '@/locales';

export const speakLanguage = () => (key: Key | null) => speak(key as Locale);
