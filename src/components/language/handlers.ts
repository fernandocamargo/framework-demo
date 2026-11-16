import { type Locale, speak } from '@/locales';

export const speakLanguage = () => (event: React.ChangeEvent<HTMLSelectElement>) =>
  // SAFETY: The select's options are the supported LOCALES.
  speak(event.currentTarget.value as Locale);
