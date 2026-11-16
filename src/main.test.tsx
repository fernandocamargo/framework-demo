import { act } from '@testing-library/react';
import { type ReactNode, use } from 'react';

import { isBusy, Pending } from '../framework/runtime/activity';
import { currentRoute } from '../framework/runtime/pipeline';
import { EditingProductContext } from './address';

const rendered = vi.hoisted(() => {
  const app: { editingId: null | number; pattern: string }[] = [];

  return { app, preload: (_locale: string): Promise<void> => Promise.resolve(), roots: 0 };
});

vi.mock('framework', async () => ({
  // The address is the real one, on React Router; the shell's folders and `Root` are stand-ins.
  bound: <T,>(element: T) => element,
  chartAt: () => Promise.resolve(null),
  createQueryClient: () => ({}),
  onFailure: () => {},
  Pending,
  Pinned: ({ children }: { children: ReactNode }) => children,
  Root: ({ children, locale, skin }: { children: ReactNode; locale: string; skin: string }) => {
    rendered.roots++;

    return (
      <main data-locale={locale} data-skin={skin}>
        {children}
      </main>
    );
  },
}));
vi.mock('react-aria-components', () => ({
  Button: () => null,
  I18nProvider: ({ children }: { children: ReactNode }) => children,
  RouterProvider: ({ children }: { children: ReactNode }) => children,
  Text: () => null,
  UNSTABLE_Toast: () => null,
  UNSTABLE_ToastContent: () => null,
  UNSTABLE_ToastQueue: class {
    add() {}
  },
  UNSTABLE_ToastRegion: () => null,
}));

vi.mock('./components/app', () => ({
  default: function App({ pattern }: { pattern: string }) {
    const editingId = use(EditingProductContext);
    rendered.app.push({ editingId, pattern });

    return null;
  },
}));
vi.mock('./components/states', () => ({ default: () => null }));
vi.mock('virtual:framework/messages', () => ({ default: (locale: string) => rendered.preload(locale) }));

const visit = (query: object) => `/products?${new URLSearchParams({ query: JSON.stringify({ v: 1, ...query }) })}`;
/** An address entered in place, and the router's answer to it. */
const move = async (href: string) => {
  window.history.pushState(null, '', href);
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate'));
    for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

test('the shell renders for an address, shows a locale when its messages are read, and keeps the last one asked for', async () => {
  window.history.replaceState(null, '', visit({ lang: 'en', world: 'memory' }));
  document.body.innerHTML = '<div id="root"></div>';
  let finishEnglish!: () => void;
  rendered.preload = () =>
    new Promise<void>((resolve) => {
      finishEnglish = resolve;
    });
  await act(async () => {
    await import('./main');
    for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(document.querySelector('main')).toBeNull();
  expect(isBusy()).toBe(true);
  await act(async () => finishEnglish());
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('en');

  const roots = rendered.roots;
  // Reordering a bookmark's query fields corrects its address without replacing the page.
  await move(`/products?${new URLSearchParams({ query: '{"v":1,"world":"memory","lang":"en"}' })}`);
  expect(rendered.roots).toBe(roots);
  await move(visit({ lang: 'en', q: 'lamp', world: 'memory' }));
  expect(rendered.roots).toBe(roots);
  expect(currentRoute()).toContain('lamp');
  await move(visit({ lang: 'en', world: 'memory' }).replace('/products?', '/products/22/edit?'));
  expect(rendered.app.at(-1)).toMatchObject({ editingId: 22, pattern: '/products/:id/edit' });
  expect(rendered.roots).toBe(roots);
  const committed = currentRoute();

  // A new language waits for its messages. Moving back while they load leaves English on screen.
  let finishPortuguese!: () => void;
  rendered.preload = () =>
    new Promise<void>((resolve) => {
      finishPortuguese = resolve;
    });
  await move(visit({ lang: 'pt-BR', skin: 'blueprint', world: 'memory' }));
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('en');
  expect(currentRoute()).toBe(committed);
  await move(visit({ lang: 'en', world: 'memory' }));
  await act(async () => finishPortuguese());
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('en');
  await move(visit({ lang: 'pt-BR', skin: 'blueprint', world: 'memory' }));
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('pt-BR');
  expect(document.querySelector('main')?.getAttribute('data-skin')).toBe('blueprint');
  expect(document.documentElement.lang).toBe('pt-BR');
  expect(currentRoute()).toContain('pt-BR');
});
