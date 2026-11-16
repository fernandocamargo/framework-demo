import { act, fireEvent, render } from '@testing-library/react';
import { createElement, Suspense } from 'react';
import { I18nProvider } from 'react-aria-components';
import { MemoryRouter } from 'react-router';

import type { Page } from '@/services/products/types';
import { createQueryClient, Root, whenIdle } from 'framework';

const observed = vi.hoisted(() => ({
  header: 0,
  shell: 0,
  waiting: 0,
}));

// What the page around the palette would show instead of itself while anything in it waits.
const Waiting = () => {
  observed.waiting += 1;

  return null;
};

// Keep the real folder graph while counting the modal shell and controlling its search reply.
vi.mock('virtual:framework/clients', () => ({ default: {}, env: {} }));

vi.mock('virtual:framework/services', () => ({
  default: [
    {
      folder: 'products',
      module: {
        search: () => () =>
          new Promise<Page>((resolve) => setTimeout(() => resolve({ items: [], page: 1, pages: 1, total: 0 }), 1)),
      },
      segments: ['products'],
    },
  ],
}));

vi.mock('react-aria-components', async (original) => {
  const components = await original<typeof import('react-aria-components')>();

  return {
    ...components,
    Button: (props: React.ComponentProps<typeof components.Button>) => {
      observed.header += 1;

      return createElement(components.Button, props);
    },
    ModalOverlay: (props: React.ComponentProps<typeof components.ModalOverlay>) => {
      observed.shell += 1;

      return createElement(components.ModalOverlay, props);
    },
  };
});

import Palette from '@/components/palette';

import { preloadSkin } from '../../../framework/runtime/style';

const page = (
  <MemoryRouter>
    <I18nProvider locale="en-US">
      <Root client={createQueryClient()} entity={{ id: 'memory' }}>
        <Suspense fallback={<Waiting />}>
          <Palette />
        </Suspense>
      </Root>
    </I18nProvider>
  </MemoryRouter>
);

test('opening the palette makes nothing wait: its search has loaded with the page', async () => {
  let shown!: ReturnType<typeof render>;
  await act(async () => {
    await preloadSkin('default');
    shown = render(page);
  });
  const button = await shown.findByRole('button', { name: 'Command palette' });
  await act(whenIdle);
  const beforeOpen = observed.waiting;
  await act(async () => {
    fireEvent.click(button);
  });
  await shown.findByRole('searchbox');
  expect(observed.waiting).toBe(beforeOpen);
  shown.unmount();
});

test('the palette shell stays still while six search outputs change', async () => {
  let shown!: ReturnType<typeof render>;
  await act(async () => {
    await preloadSkin('default');
    shown = render(page);
  });
  const button = await shown.findByRole('button', { name: 'Command palette' });
  await act(async () => {
    fireEvent.click(button);
  });
  const input = await shown.findByRole('searchbox');
  const search = document.querySelector('search');
  expect(search?.parentElement?.getAttribute('role')).toBe('dialog');
  expect(search?.getAttribute('class')).toBeNull();
  const afterOpen = { header: observed.header, shell: observed.shell };
  const outputs: string[] = [];
  vi.useFakeTimers();

  try {
    for (const text of ['l', 'la', 'lam', 'lamp']) {
      await act(async () => {
        fireEvent.change(input, { target: { value: text } });
      });
      outputs.push(document.querySelector('meta[itemprop="query"]')?.getAttribute('content') ?? '');
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    outputs.push(String(document.querySelector('search')?.getAttribute('aria-busy')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    outputs.push(String(document.querySelector('search')?.getAttribute('aria-busy')));
    expect(outputs).toEqual(['l', 'la', 'lam', 'lamp', 'true', 'null']);
    expect({ header: observed.header, shell: observed.shell }).toEqual(afterOpen);
  } finally {
    vi.useRealTimers();
    shown.unmount();
  }
});
