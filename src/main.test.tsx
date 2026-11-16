import { act } from '@testing-library/react';
import type { ReactNode } from 'react';

const rendered = vi.hoisted(() => ({ roots: 0 }));

vi.mock('framework', async () => ({
  ...(await import('../framework/runtime/routes')),
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
  RouterProvider: ({ children }: { children: ReactNode }) => children,
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

test('an unchanged locale and skin do not render the shell on popstate', async () => {
  window.history.replaceState(
    null,
    '',
    '/products?query=%7B%22v%22%3A1%2C%22lang%22%3A%22en%22%2C%22world%22%3A%22memory%22%7D',
  );
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => {
    await import('./main');
  });
  rendered.roots = 0;

  await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(rendered.roots).toBe(0);

  window.history.pushState(
    null,
    '',
    '/products?query=%7B%22v%22%3A1%2C%22lang%22%3A%22pt-BR%22%2C%22skin%22%3A%22blueprint%22%2C%22world%22%3A%22memory%22%7D',
  );
  await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(document.querySelector('main')?.getAttribute('data-locale')).toBe('pt-BR');
  expect(document.querySelector('main')?.getAttribute('data-skin')).toBe('blueprint');
  expect(document.documentElement.lang).toBe('pt-BR');
});
