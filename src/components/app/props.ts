import { links, SECTIONS } from '@/address';

// The page's rules. Changing the catalogue needs a session: when the address opens one of
// those dialogs and nobody is signed in, the sign-in dialog is asked for, on top of it.
export type Props = {
  /** Whether the address has changed and its page is still being read. */
  navigating: boolean;
};

export default ({ async: { default: page }, i18n, navigating, route, routes }) => {
  const { sectionHref } = links(route);
  const { session } = page;
  const section = page.pattern.split('/')[1];
  const changing =
    page.pattern === '/products/new' ||
    page.pattern.startsWith('/products/bulk') ||
    /\/(edit|remove)$/.test(page.pattern);
  return {
    askToSignIn: !session && (page.signin || changing),
    brand: i18n.brand,
    navigating,
    routes,
    sections: SECTIONS.map((id) => ({
      current: id === section,
      href: sectionHref(id),
      id,
      label: i18n.sections[id],
    })),
    signInReason: !session && changing ? i18n.signIn.reason : null,
    skip: i18n.skip,
    states: i18n.states,
    world: page.world === 'memory' ? i18n.world.memory : i18n.world.dummyjson,
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'A product open': { props: { navigating: false }, route: { params: { id: 22 }, pattern: '/products/:id' } },
  'Reading the next page': { props: { navigating: true } },
  'The page': { props: { navigating: false } },
};
