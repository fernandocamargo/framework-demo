// The language switch: every locale the app speaks, each named in itself, so a person finds
// their own language whatever the page shows now.

import { endonym, LOCALES } from '@/locales';

export default ({ i18n, locale }) => ({
  label: i18n.label,
  locale,
  options: LOCALES.map((id) => ({ id, name: endonym(id) })),
});
