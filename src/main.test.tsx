import { act } from '@testing-library/react';
import type { ReactNode } from 'react';

const rendered = vi.hoisted(() => ({ preload: (_locale: string): Promise<void> => Promise.resolve(), roots: 0 }));

vi.mock('framework', () => ({
  chartAt: () => Promise.resolve(null),
  createQueryClient: () => ({}),
  onFailure: () => {},
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
  Text: () => null,
  UNSTABLE_Toast: () => null,
  UNSTABLE_ToastContent: () => null,
  UNSTABLE_ToastQueue: class {
    add() {}
  },
  UNSTABLE_ToastRegion: () => null,
}));
vi.mock('./components/app', () => ({ default: () => null }));
vi.mock('./components/states', () => ({ default: () => null }));
vi.mock('virtual:framework/messages', () => ({ default: (locale: string) => rendered.preload(locale) }));

test('an unchanged locale and skin do not render the shell on popstate', async () => {
  window.history.replaceState(null, '', '/?world=memory&lang=en#/products');
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => {
    await import('./main');
  });
  rendered.roots = 0;

  await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(rendered.roots).toBe(0);

  window.history.pushState(null, '', '/?world=memory&lang=pt-BR&skin=blueprint#/products');
  await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('pt-BR');
  expect(document.querySelector('main')?.getAttribute('data-skin')).toBe('blueprint');
  expect(document.documentElement.lang).toBe('pt-BR');

  let finishEnglish!: () => void;
  rendered.preload = (locale) =>
    locale === 'en'
      ? new Promise<void>((resolve) => {
          finishEnglish = resolve;
        })
      : Promise.resolve();
  window.history.pushState(null, '', '/?world=memory&lang=en&skin=blueprint#/products');
  await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  window.history.pushState(null, '', '/?world=memory&lang=pt-BR&skin=blueprint#/products');
  await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('pt-BR');
  await act(async () => finishEnglish());
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('pt-BR');
});
