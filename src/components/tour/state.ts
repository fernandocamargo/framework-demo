// The guided tour: a flow over the app, as a statechart. Each step does what the README asks a
// visitor to try by hand, through the same services a visitor's clicks reach, and then waits for
// the visitor to read it. Leaving the tour, from any step, tidies what it changed: the network lab's
// faults are off and the address shows the plain list.

import { HOME } from '@/address';
import { DEMO } from '@/components/session/form';
import { currentLocale, type Locale, speak } from '@/locales';
import { currentSkin, type Skin, wear } from '@/skins';

/** The steps, in order. `closed` is not one of them. */
export const STEPS = [
  'address',
  'product',
  'slow',
  'failing',
  'healed',
  'person',
  'flag',
  'skin',
  'language',
  'finished',
] as const;

export const description =
  'The guided tour: each step performs one thing the README asks a visitor to try, and says what to look at.';

export const context = () => ({
  /** The locale and the skin the page wore when the tour started: leaving puts them back. */
  before: null as null | { locale: Locale; skin: Skin },
  error: null as null | string,
  remote: false,
});

// ---- Changes and inputs ----------------------------------------------------------------------

export const openAddress = ({ navigation }) =>
  navigation.go('/products', {}, { ...HOME, order: 'desc', signin: false, sort: 'price' });
export const openProduct = ({ navigation }) => navigation.go('/products/:id', { id: 4 });
export const secondPage = ({ navigation }) => navigation.go('/products', {}, { page: 2 });
export const firstPage = ({ navigation }) => navigation.query('/products', { page: 1 });
export const thirdPage = ({ navigation }) => navigation.query('/products', { page: 3 });
export const slowRequests = () => ({ latency: 1500 });
export const breakRequests = () => ({ force: 500 as const, latency: 0 });
export const healRequests = () => ({ force: 0 as const });
export const demoAdmin = () => DEMO;
export const stockCount = () => ({ name: 'stockCount' as const, way: 'everyone' as const });
export const wearBroadsheet = () => wear('broadsheet');
export const speakPortuguese = () => speak('pt-BR');

export const rememberError = ({ event }) => ({
  error: event.error instanceof Error ? event.error.message : String(event.error),
});
export const forgetError = () => ({ error: null });
/** The flags are served by GrowthBook, which owns this one: the step says so and moves on. */
export const rememberRemote = () => ({ remote: true });

/** Starting the tour: remember the locale and the skin, to put them back when it is left. */
export const remember = () => ({ before: { locale: currentLocale(), skin: currentSkin() } });

/** Leaving the tour: the lab's faults off, the list plain, and the locale and skin the page had. */
export const tidy = ({ context, navigation, services }) => {
  services.lab.change({ failureRate: 0, force: 0, latency: 0 });
  navigation.go('/products', {}, { signin: false });
  if (context.before) {
    wear(context.before.skin);
    speak(context.before.locale);
  }
  return { before: null };
};

// ---- The statechart --------------------------------------------------------------------------

export default ({ services }) => ({
  closed: {
    description: 'The tour is not on screen. The button in the header, or `t`, starts it.',
    on: { start: { actions: remember, target: 'address' } },
  },
  address: {
    description: 'The address holds the filters: the list is sorted by price, highest first.',
    entry: openAddress,
    on: {
      leave: { actions: tidy, target: 'closed' },
      next: 'product',
    },
  },
  product: {
    description: 'The address names one product, and its dialog opens over the list.',
    entry: openProduct,
    on: {
      back: 'address',
      leave: { actions: tidy, target: 'closed' },
      next: 'slow',
    },
  },
  slow: {
    description: 'Every request waits 1.5 seconds, so the page keeps the list on screen while the next page is read.',
    entry: secondPage,
    invoke: { input: slowRequests, src: services.lab.change },
    on: {
      back: 'product',
      leave: { actions: tidy, target: 'closed' },
      next: 'failing',
    },
  },
  failing: {
    description: 'Every request fails with a server error, and the catalogue says it could not be read.',
    entry: thirdPage,
    invoke: { input: breakRequests, src: services.lab.change },
    on: {
      back: 'slow',
      leave: { actions: tidy, target: 'closed' },
      next: 'healed',
    },
  },
  healed: {
    description: 'Requests answer again, and the catalogue shows its rows from the first page.',
    entry: firstPage,
    invoke: { input: healRequests, src: services.lab.change },
    on: {
      back: 'failing',
      leave: { actions: tidy, target: 'closed' },
      next: 'person',
    },
  },
  person: {
    description: 'An admin signs in with the demo account, and the header names the person.',
    entry: forgetError,
    invoke: { input: demoAdmin, onError: { actions: rememberError }, src: services.auth.signIn },
    on: {
      back: 'healed',
      leave: { actions: tidy, target: 'closed' },
      next: 'flag',
    },
  },
  flag: {
    description: 'The stock count flag is served to everyone, so the rows of an admin get their steppers.',
    invoke: {
      input: stockCount,
      onError: { actions: rememberRemote, target: 'skin' },
      src: services.flags.serve,
    },
    on: {
      back: 'person',
      leave: { actions: tidy, target: 'closed' },
      next: 'skin',
    },
  },
  skin: {
    description: 'The page wears the broadsheet skin: the same markup in another sheet.',
    entry: wearBroadsheet,
    on: {
      back: 'flag',
      leave: { actions: tidy, target: 'closed' },
      next: 'language',
    },
  },
  language: {
    description: 'The page and the tour speak Brazilian Portuguese, and the address keeps the language.',
    entry: speakPortuguese,
    on: {
      back: 'skin',
      leave: { actions: tidy, target: 'closed' },
      next: 'finished',
    },
  },
  finished: {
    description: 'The tour is done. Finishing closes it and puts back the skin and the language the page had.',
    on: {
      back: 'language',
      leave: { actions: tidy, target: 'closed' },
      next: { actions: tidy, target: 'closed' },
    },
  },
});
