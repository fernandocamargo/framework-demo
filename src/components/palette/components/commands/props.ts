// Every command the palette lists, in sections, each one's label matched against what is typed.
// What is on screen follows what can be done now: a key the chart or the permissions refuse is
// listed as not now. A command closes the palette first: the page under a modal is inert until then.

import { go, sectionHref, SECTIONS } from '@/address';
import { endonym, LOCALES, speak } from '@/locales';
import type { Listed } from '@/services/products/types';
import { SKINS, wear } from '@/skins';

export type Props = {
  onClose: () => void;
  onType: (text: string) => void;
  results: Listed[];
  searching: boolean;
  text: string;
};

/** Whether a command's label matches what was typed: it contains it, whatever the case. */
export const matches = (textValue: string, inputValue: string) =>
  textValue.toLocaleLowerCase().includes(inputValue.trim().toLocaleLowerCase());

export default ({ i18n, keyboard, onClose, onType, results, searching, text, user }) => {
  // The palette is a modal: its command runs once it has closed, so the page under it is live again.
  const perform = (act: () => void) => () => {
    onClose();
    setTimeout(act, 0);
  };
  const command = (id: string, label: string, act: () => void, available = true, keys: string[] = []) => ({
    available,
    id,
    keys,
    kind: 'action' as const,
    label,
    perform: perform(act),
  });

  const onThisPage = keyboard.groups
    .filter(({ path }) => path !== 'components/palette')
    .flatMap(({ path, shortcuts }) =>
      shortcuts.map((shortcut) => ({
        available: shortcut.available,
        id: `${path}#${shortcut.keys.join('+')}`,
        keys: [...shortcut.keys],
        kind: 'action' as const,
        label: shortcut.label,
        perform: perform(shortcut.run),
      })),
    );

  const sections = [
    { heading: i18n.sections.onThisPage, id: 'page', items: onThisPage },
    {
      heading: i18n.sections.goTo,
      id: 'go',
      items: [
        ...SECTIONS.map((section) =>
          command(`section:${section}`, i18n.go[section], () => {
            window.location.hash = sectionHref(section);
          }),
        ),
        command('states', i18n.go.states, () => {
          window.location.hash = '#/states';
        }),
      ],
    },
    {
      heading: i18n.sections.appearance,
      id: 'appearance',
      items: [
        ...SKINS.map((skin) => command(`skin:${skin}`, i18n.skins[skin], () => wear(skin))),
        ...LOCALES.map((locale) => command(`locale:${locale}`, endonym(locale), () => speak(locale))),
      ],
    },
    {
      heading: i18n.sections.session,
      id: 'session',
      items: user ? [] : [command('signin', i18n.signIn, () => go({ signin: true }))],
    },
    {
      heading: i18n.sections.products,
      id: 'products',
      items: results.map((product) => ({
        available: true,
        id: `product:${product.id}`,
        keys: [],
        kind: 'product' as const,
        label: product.title,
        perform: perform(() => go({ view: product.id })),
      })),
    },
  ];

  // Products came from the search for what is typed, so they are listed as they are; the commands
  // are matched here.
  const shown = sections
    .map((section) => ({
      ...section,
      items: section.id === 'products' ? section.items : section.items.filter((item) => matches(item.label, text)),
    }))
    .filter((section) => section.items.length > 0);

  return { empty: shown.length === 0, i18n, onClose, onType, searching, sections: shown, text };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The commands, with a search': {
    props: { onClose: () => undefined, onType: () => undefined, results: [], searching: false, text: 'lamp' },
  },
};
