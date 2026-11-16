import { links, SECTIONS, type Settings } from '@/address';

// The page's rules. Changing the catalogue needs a session: when the address opens one of
// those dialogs and nobody is signed in, the sign-in dialog is asked for, on top of it.
export type Props = {
  pattern: string;
  settings: Settings;
};

export default ({ async: { default: page }, i18n, pattern, routes, settings }) => {
  const { sectionHref } = links(settings);
  const { session } = page;
  const section = pattern.split('/')[1];
  const changing =
    pattern === '/products/new' || pattern.startsWith('/products/bulk') || /\/(edit|remove)$/.test(pattern);
  return {
    askToSignIn: !session && (settings.signin || changing),
    brand: i18n.brand,
    lang: settings.lang,
    productOpen: !session && (settings.signin || changing) && pattern.startsWith('/products/'),
    routes,
    sections: SECTIONS.map((id) => ({
      current: id === section,
      href: sectionHref(id),
      id,
      label: i18n.sections[id],
    })),
    signInReason: !session && changing ? i18n.signIn.reason : null,
    skin: settings.skin,
    skip: i18n.skip,
    states: i18n.states,
    world: page.world === 'memory' ? i18n.world.memory : i18n.world.dummyjson,
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
const page = {
  pattern: '/products',
  settings: { lang: '', signin: false, skin: 'default', world: 'memory' },
};
export const examples = {
  'A product open': {
    props: { ...page, pattern: '/products/:id' },
    route: { params: { id: 22 }, pattern: '/products/:id' },
  },
  'The page': { props: page },
};
