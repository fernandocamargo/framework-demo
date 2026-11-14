// Each flag, the value the person signed in gets, and the ways it can be served, in the locale on
// screen. The values come from `flags`, as every component gets them; the ways, from the flags'
// definitions. When GrowthBook serves the flags, its dashboard chooses: only the values show.

import { definitions, names } from '@/clients/flags/definitions';

export default ({ async: { default: served, serve }, flags, i18n, intl }) => ({
  flags: names.map((name) => {
    const value = flags[name];
    const ways = i18n.flags[name].ways as Record<string, string>;
    return {
      choose: (way: string) => serve(name, way as never),
      key: definitions[name].key,
      name,
      served: served ? (served[name] as string) : null,
      title: i18n.flags[name].name,
      value: i18n.value({
        value:
          typeof value === 'boolean'
            ? value
              ? i18n.on
              : i18n.off
            : intl.formatNumber(value / 100, { style: 'percent' }),
      }),
      ways: served ? Object.keys(definitions[name].ways).map((way) => ({ id: way, label: ways[way] ?? way })) : [],
    };
  }),
  intro: served ? i18n.intro : i18n.remote,
  label: i18n.label,
  sending: serve.pending,
});
