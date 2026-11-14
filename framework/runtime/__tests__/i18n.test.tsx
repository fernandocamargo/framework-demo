import { act, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
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
      await act(async () => shown!.rerender(next));
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
