import { act, fireEvent, render } from '@testing-library/react';
import { createContext, createElement, type ReactNode, startTransition, Suspense, use, useState } from 'react';
import { useLocale } from 'react-aria';
import { I18nProvider } from 'react-aria-components';

import { whenIdle } from '../activity';
import { component } from '../component';
import { createQueryClient } from '../data';
import { loadMessages, preloadMessages } from '../i18n';
import { onFailure } from '../pipeline';
import { Root } from '../root';

vi.mock('virtual:framework/clients', () => ({ default: {}, env: {} }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
const view = (render: (props: Props) => ReactNode, shape?: (props: Props) => Props) => () =>
  Promise.resolve({
    async: undefined,
    children: [],
    form: undefined,
    props: shape ? { default: shape } : undefined,
    render,
    state: undefined,
  });
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(element);
  });
  await settle();
  return {
    container: shown!.container,
    rerender: async (next: ReactNode) => {
      await act(() => startTransition(() => shown!.rerender(next)));
      await settle();
    },
  };
}
const entity = { id: 'shop' } as never;

const messages = {
  default: {
    found: '{count, plural, one {# product} other {# products}}',
    title: 'Products',
  },
};
const translations = {
  'pt-BR': () =>
    Promise.resolve({
      default: {
        'components/speaks/found': '{count, plural, one {# produto} other {# produtos}}',
        'components/speaks/title': 'Produtos',
      },
    }),
};

test('preloading two folders waits for both and leaves settled messages for a later mount', async () => {
  let finish!: (value: { default: Record<string, string> }) => void;
  const slow = new Promise<{ default: Record<string, string> }>((resolve) => {
    finish = resolve;
  });
  const first = {
    i18n: { default: { title: 'First' } },
    path: 'components/preload-first',
    translations: { 'pt-BR': () => Promise.resolve({ default: { 'components/preload-first/title': 'Primeiro' } }) },
  };
  const second = {
    i18n: { default: { title: 'Second' } },
    path: 'components/preload-second',
    translations: { 'pt-BR': () => slow },
  };
  let finished = false;
  const loading = preloadMessages([first, second], 'pt-BR').then(() => {
    finished = true;
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(finished).toBe(false);
  await act(async () => finish({ default: { 'components/preload-second/title': 'Segundo' } }));
  await loading;

  // SAFETY: Both folders declare title in their source messages.
  const Reader = ({ spec }: { spec: typeof first | typeof second }) =>
    createElement('span', null, (use(loadMessages(spec, 'pt-BR')) as { title: string }).title);
  const { container, rerender } = render(
    createElement(
      Suspense,
      { fallback: createElement('span', null, 'Waiting') },
      createElement(Reader, { spec: first }),
    ),
  );
  expect(container.textContent).toBe('Primeiro');
  await act(async () => {
    // A folder mounted after the switch reads the same settled cache.
    rerender(createElement(Reader, { spec: second }));
  });
  expect(container.textContent).toBe('Segundo');
});

test('two folders and react-aria change once together after the slower translation', async () => {
  let finish!: (value: { default: Record<string, string> }) => void;
  const slow = new Promise<{ default: Record<string, string> }>((resolve) => {
    finish = resolve;
  });
  const first = {
    i18n: { default: { title: 'First' } },
    path: 'components/paired-first',
    translations: { 'pt-BR': () => Promise.resolve({ default: { 'components/paired-first/title': 'Primeiro' } }) },
  };
  const second = {
    i18n: { default: { title: 'Second' } },
    path: 'components/paired-second',
    translations: { 'pt-BR': () => slow },
  };
  const First = component({
    ...first,
    skins: {},
    // SAFETY: This folder declares title in its source messages.
    view: view(({ i18n }) => createElement('span', null, (i18n as { title: string }).title)),
  });
  const Second = component({
    ...second,
    skins: {},
    // SAFETY: This folder declares title in its source messages.
    view: view(({ i18n }) => createElement('span', null, (i18n as { title: string }).title)),
  });
  const client = createQueryClient();
  function AriaLocale() {
    return createElement('span', null, useLocale().locale);
  }
  function Page() {
    const [locale, setLocale] = useState('en');
    const switchLocale = () =>
      startTransition(async () => {
        await preloadMessages([first, second], 'pt-BR');
        startTransition(() => setLocale('pt-BR'));
      });
    return createElement(I18nProvider, {
      children: createElement(
        Root,
        { client, entity, locale },
        createElement('button', { onClick: switchLocale }, 'Switch'),
        createElement(First),
        createElement(Second),
        createElement(AriaLocale),
      ),
      locale,
    });
  }

  const { container } = await show(createElement(Page));
  expect(container.textContent).toBe('SwitchFirstSeconden');
  const changes: string[] = [];
  const observer = new MutationObserver(() => changes.push(container.textContent ?? ''));
  observer.observe(container, { characterData: true, childList: true, subtree: true });
  await act(() => fireEvent.click(container.querySelector('button')!));
  expect(container.textContent).toBe('SwitchFirstSeconden');
  await act(async () => finish({ default: { 'components/paired-second/title': 'Segundo' } }));
  await settle();
  observer.disconnect();
  expect(container.textContent).toBe('SwitchPrimeiroSegundopt-BR');
  expect(changes).toEqual(['SwitchPrimeiroSegundopt-BR']);
});

test('a sibling reads the new context after another consumer suspends in a transition', async () => {
  const Language = createContext('en');
  let finish!: (value: string) => void;

  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });

  function Reader({ delayed }: { delayed: boolean }) {
    const locale = use(Language);

    if (delayed && locale === 'pt-BR') use(pending);

    return createElement('span', null, `${delayed ? 'delayed' : 'sibling'}:${locale}`);
  }

  function Page() {
    const [locale, setLocale] = useState('en');

    return createElement(
      Language,
      { value: locale },
      createElement('button', { onClick: () => startTransition(() => setLocale('pt-BR')) }, 'Switch'),
      createElement(Reader, { delayed: true }),
      createElement(Reader, { delayed: false }),
    );
  }

  const { container, getByRole } = render(createElement(Page));
  expect(container.textContent).toBe('Switchdelayed:ensibling:en');
  await act(() => fireEvent.click(getByRole('button')));
  expect(container.textContent).toBe('Switchdelayed:ensibling:en');
  await act(async () => finish('ready'));
  expect(container.textContent).toBe('Switchdelayed:pt-BRsibling:pt-BR');
});

test('framework siblings receive a changed locale after a translation suspends in a transition', async () => {
  let finish!: (value: { default: Record<string, string> }) => void;

  const pending = new Promise<{ default: Record<string, string> }>((resolve) => {
    finish = resolve;
  });

  const Speaks = component({
    i18n: { default: { title: 'Products' } },
    path: 'components/transition-speaks',
    skins: {},
    translations: { 'pt-BR': () => pending },
    view: view(({ i18n }) => {
      // SAFETY: This folder declares title in its source messages.
      return createElement('span', null, (i18n as { title: string }).title);
    }),
  });

  const Formats = component({
    path: 'components/transition-formats',
    reads: { view: ['intl'] },
    skins: {},
    view: view(({ intl }) => {
      // SAFETY: The declared intl read supplies the framework's formatter.
      return createElement('span', null, (intl as { formatNumber: (value: number) => string }).formatNumber(1234.5));
    }),
  });

  const client = createQueryClient();

  function Page() {
    const [locale, setLocale] = useState('en');

    return createElement(
      Root,
      { client, entity, locale },
      createElement('button', { onClick: () => startTransition(() => setLocale('pt-BR')) }, 'Switch'),
      createElement(Speaks),
      createElement(Formats),
    );
  }

  const { container } = await show(createElement(Page));
  expect(container.textContent).toBe('SwitchProducts1,234.5');
  await act(() => fireEvent.click(container.querySelector('button')!));
  expect(container.textContent).toBe('SwitchProducts1,234.5');
  await act(async () => finish({ default: { 'components/transition-speaks/title': 'Produtos' } }));
  await settle();
  expect(container.textContent).toBe('SwitchProdutos1.234,5');
});

test('react-aria and a folder change together after delayed messages settle', async () => {
  let finish!: (value: { default: Record<string, string> }) => void;

  const pending = new Promise<{ default: Record<string, string> }>((resolve) => {
    finish = resolve;
  });

  const Speaks = component({
    i18n: { default: { title: 'Products' } },
    path: 'components/paired-speaks',
    skins: {},
    translations: { 'pt-BR': () => pending },
    view: view(({ i18n }) => {
      // SAFETY: This folder declares title in its source messages.
      return createElement('span', null, (i18n as { title: string }).title);
    }),
  });

  function AriaLocale() {
    return createElement('span', null, useLocale().locale);
  }

  const client = createQueryClient();

  function Page() {
    const [locale, setLocale] = useState('en');

    return createElement(I18nProvider, {
      children: createElement(
        Root,
        { client, entity, locale },
        createElement(
          'button',
          { onClick: () => startTransition(() => setLocale(locale === 'en' ? 'pt-BR' : 'en')) },
          'Switch',
        ),
        createElement(Speaks),
        createElement(AriaLocale),
      ),
      locale,
    });
  }

  const { container } = await show(createElement(Page));
  expect(container.textContent).toBe('SwitchProductsen');

  const changes: string[] = [];
  const observer = new MutationObserver(() => changes.push(container.textContent ?? ''));
  observer.observe(container, { characterData: true, childList: true, subtree: true });

  await act(() => fireEvent.click(container.querySelector('button')!));
  expect(container.textContent).toBe('SwitchProductsen');

  let idle = false;
  const waiting = whenIdle().then(() => {
    idle = true;
  });

  await settle();
  expect(idle).toBe(false);
  await act(async () => finish({ default: { 'components/paired-speaks/title': 'Produtos' } }));
  await settle();
  await waiting;
  observer.disconnect();
  expect(container.textContent).toBe('SwitchProdutospt-BR');
  expect(changes).toEqual(['SwitchProdutospt-BR']);

  await act(() => fireEvent.click(container.querySelector('button')!));
  expect(container.textContent).toBe('SwitchProductsen');
  await act(() => fireEvent.click(container.querySelector('button')!));
  expect(container.textContent).toBe('SwitchProdutospt-BR');
});

test('rapid switches show the last requested locale', async () => {
  const finishes: Record<string, (value: { default: Record<string, string> }) => void> = {};
  const translation = (locale: string) =>
    new Promise<{ default: Record<string, string> }>((resolve) => {
      finishes[locale] = resolve;
    });

  const Speaks = component({
    i18n: { default: { title: 'Products' } },
    path: 'components/rapid-speaks',
    skins: {},
    translations: { de: () => translation('de'), 'pt-BR': () => translation('pt-BR') },
    view: view(({ i18n }) => {
      // SAFETY: This folder declares title in its source messages.
      return createElement('span', null, (i18n as { title: string }).title);
    }),
  });

  const client = createQueryClient();

  function Page() {
    const [locale, setLocale] = useState('en');

    return createElement(
      Root,
      { client, entity, locale },
      createElement('button', { onClick: () => startTransition(() => setLocale('pt-BR')) }, 'Portuguese'),
      createElement('button', { onClick: () => startTransition(() => setLocale('de')) }, 'German'),
      createElement(Speaks),
    );
  }

  const { container } = await show(createElement(Page));
  await act(() => fireEvent.click(container.querySelectorAll('button')[0]!));
  await act(() => fireEvent.click(container.querySelectorAll('button')[1]!));
  expect(container.textContent).toBe('PortugueseGermanProducts');
  await act(async () => finishes['de']!({ default: { 'components/rapid-speaks/title': 'Produkte' } }));
  await settle();
  expect(container.textContent).toBe('PortugueseGermanProdukte');
  await act(async () => finishes['pt-BR']!({ default: { 'components/rapid-speaks/title': 'Produtos' } }));
  await settle();
  expect(container.textContent).toBe('PortugueseGermanProdukte');
});

test('a failed translation shows source words and reports once', async () => {
  let fail!: (error: Error) => void;

  const pending = new Promise<{ default: Record<string, string> }>((_, reject) => {
    fail = reject;
  });

  const spec = {
    i18n: { default: { title: 'Products' } },
    path: 'components/failed-speaks',
    skins: {},
    translations: { 'pt-BR': () => pending },
    view: view(({ i18n, locale }) => {
      // SAFETY: This folder declares title in its source messages.
      return createElement('span', null, `${(i18n as { title: string }).title}:${String(locale)}`);
    }),
  };
  const Speaks = component(spec);

  const failures: string[] = [];
  const stop = onFailure((failure) =>
    failures.push(`${failure.layer}:${failure.path}:${failure.during}:${failure.error.message}`),
  );
  const client = createQueryClient();

  function Page() {
    const [locale, setLocale] = useState('en');

    return createElement(
      Root,
      { client, entity, locale },
      createElement(
        'button',
        {
          onClick: () =>
            startTransition(async () => {
              await preloadMessages([spec], 'pt-BR');
              startTransition(() => setLocale('pt-BR'));
            }),
        },
        'Switch',
      ),
      createElement(Speaks),
      createElement(Speaks),
    );
  }

  try {
    const { container } = await show(createElement(Page));
    expect(container.textContent).toBe('SwitchProducts:enProducts:en');
    await act(() => fireEvent.click(container.querySelector('button')!));
    expect(container.textContent).toBe('SwitchProducts:enProducts:en');
    await act(async () => fail(new Error('Translation unavailable')));
    await settle();
    expect(container.textContent).toBe('SwitchProducts:pt-BRProducts:pt-BR');
    expect(failures).toEqual(['i18n:components/failed-speaks:pt-BR:Translation unavailable']);
  } finally {
    stop();
  }
});

test('a loaded view starts its child messages in the locale it rendered', async () => {
  let finishView!: () => void;
  let finishTranslation!: (value: { default: Record<string, string> }) => void;
  let loads = 0;

  const loadingView = new Promise<void>((resolve) => {
    finishView = resolve;
  });
  const loadingTranslation = new Promise<{ default: Record<string, string> }>((resolve) => {
    finishTranslation = resolve;
  });

  const Child = component({
    i18n: { default: { title: 'Child' } },
    path: 'components/preloaded-child',
    skins: {},
    translations: {
      'pt-BR': () => {
        loads++;
        return loadingTranslation;
      },
    },
    view: view(({ i18n }) => {
      // SAFETY: This folder declares title in its source messages.
      return createElement('span', null, (i18n as { title: string }).title);
    }),
  });

  const Parent = component({
    path: 'components/preloading-parent',
    skins: {},
    view: () =>
      loadingView.then(() => ({
        async: undefined,
        children: [Child],
        form: undefined,
        props: undefined,
        render: () => createElement('span', null, 'parent'),
        state: undefined,
      })),
  });

  const client = createQueryClient();
  let shown!: ReturnType<typeof render>;
  await act(async () => {
    shown = render(createElement(Root, { client, entity, locale: 'pt-BR' }, createElement(Parent)));
  });
  expect(loads).toBe(0);
  await act(async () => finishView());
  expect(shown.container.textContent).toBe('parent');
  expect(loads).toBe(1);
  await act(async () => finishTranslation({ default: { 'components/preloaded-child/title': 'Filho' } }));
});

test('a component with messages shows them in the locale on screen, and only components that read the locale render again', async () => {
  const calls: string[] = [];
  const Speaks = component({
    i18n: messages,
    path: 'components/speaks',
    skins: {},
    translations,
    view: view(
      ({ found, title }) => {
        calls.push('speaks');
        return createElement('p', null, `${String(title)}: ${String(found)}`);
      },
      ({ i18n }) => {
        const words = i18n as { found: (values: { count: number }) => string; title: string };
        return { found: words.found({ count: 2 }), title: words.title };
      },
    ),
  });
  const Formats = component({
    path: 'components/formats',
    reads: { view: ['intl'] },
    skins: {},
    view: view(({ intl }) => {
      calls.push('formats');
      return createElement('p', null, (intl as { formatNumber: (value: number) => string }).formatNumber(1234.5));
    }),
  });
  const Silent = component({
    path: 'components/silent',
    skins: {},
    view: view(() => {
      calls.push('silent');
      return createElement('p', null, 'silent');
    }),
  });
  const client = createQueryClient();
  const page = (locale: string) =>
    createElement(
      Root,
      { client, entity, locale },
      createElement(Speaks),
      createElement(Formats),
      createElement(Silent),
    );
  const { container, rerender } = await show(page('en'));
  expect(container.textContent).toBe('Products: 2 products1,234.5silent');
  calls.length = 0;

  await rerender(page('pt-BR'));
  expect(container.textContent).toBe('Produtos: 2 produtos1.234,5silent');
  expect(calls.sort()).toEqual(['formats', 'speaks']);
});

test("a locale with no translation file shows the source, and a region falls back to its language's file", async () => {
  const Speaks = component({
    i18n: messages,
    path: 'components/speaks',
    skins: {},
    translations: { pt: translations['pt-BR'] },
    view: view(({ i18n }) => createElement('p', null, (i18n as { title: string }).title)),
  });
  const client = createQueryClient();
  const page = (locale: string) => createElement(Root, { client, entity, locale }, createElement(Speaks));
  const { container, rerender } = await show(page('de'));
  expect(container.textContent).toBe('Products');
  await rerender(page('pt-PT'));
  expect(container.textContent).toBe('Produtos');
});
