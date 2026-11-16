import type { Key } from 'react-aria-components';

import { LOCALES, speak } from '@/locales';

export const speakLanguage =
  ({ navigation }) =>
  (key: Key | null) => {
    const locale = LOCALES.find((value) => value === key);

    if (locale) speak(navigation, locale);
  };
