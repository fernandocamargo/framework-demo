import { type Locale, speak } from '@/locales';

export const speakLanguage =
  ({ navigation }) =>
  (event: React.ChangeEvent<HTMLSelectElement>) =>
    // SAFETY: The select's options are the supported LOCALES.
    speak(navigation, event.currentTarget.value as Locale);
