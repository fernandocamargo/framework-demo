import { act, render, waitFor } from '@testing-library/react';
import { useSelector } from '@xstate/react';
import { createElement } from 'react';
import type { AnyActorRef } from 'xstate';

import { bound } from '../../../framework/runtime/boundaries';
import { createQueryClient } from '../../../framework/runtime/data';
import { intlFor } from '../../../framework/runtime/i18n';
import { useStateLayer } from '../../../framework/runtime/machine';
import { Root } from '../../../framework/runtime/root';
import { shortcutsOf } from '../../../framework/runtime/shortcuts';
import { formOf } from '../../../framework/runtime/testing';
import Progress from './components/progress';
import * as form from './form';
import shortcuts from './shortcuts';
import * as wizard from './state';

const items = Array.from({ length: 9 }, (_, index) => ({
  category: 'desks',
  description: '',
  id: index + 1,
  price: 100,
  rating: 4,
  stock: 1,
  thumbnail: '',
  title: `Product ${index + 1}`,
  version: 1,
}));

const acl = {
  allowed: true,
  grants: { customers: [], orders: [], prices: ['update'], products: ['read'] },
  limits: { priceChange: null },
  role: 'admin',
};

const flags = { largeChangeAt: 50 };

const i18n = {
  done: 'Done',
  keys: { apply: 'Apply the change', next: 'Next step' },
  progress: {
    done: ({ done, total }: { done: number; total: number }) => `${done} of ${total}`,
    label: 'Prices saved',
    saving: ({ title }: { title: string }) => `Saving ${title}`,
  },
  results: 'Results',
  retryFailed: ({ count }: { count: number }) => `Retry ${count}`,
  summary: ({ changed, failed }: { changed: number; failed: number }) => `${changed} changed, ${failed} failed`,
};

const intl = intlFor('en');

test('the chart sends nine results to Progress without rerendering the shell between phases', async () => {
  const fields = formOf(form);
  const pending: { reject: (error: Error) => void; resolve: () => void }[] = [];
  const save = vi.fn(() => new Promise<void>((resolve, reject) => pending.push({ reject, resolve })));
  const services = { products: { save, search: async () => ({ items, page: 1, pages: 1, total: 9 }) } };
  const sources = { acl, flags, form: fields, navigation: { go: vi.fn() }, services };
  const injection = { services };
  let shell = 0;
  let actor: AnyActorRef | undefined;
  let state: ReturnType<typeof useStateLayer> | undefined;
  const progress: number[] = [];

  const shortcut = () =>
    shortcutsOf('components/bulk-price', { default: shortcuts }, { acl, i18n, state }, state, {
      parent: null,
      path: 'components/bulk-price',
    })[0]!;

  // SAFETY: Progress reads only these messages in this focused fixture.
  const messages = i18n as never;

  function Follower({ wizard: source }: { wizard: AnyActorRef }) {
    progress.push(useSelector(source, (snapshot) => snapshot.context.results.length));

    return bound(
      createElement(Progress, {
        closeWizard: () => undefined,
        i18n: messages,
        intl,
        retryFailed: () => source.send({ type: 'retryFailed' }),
        wizard: source,
      }),
    );
  }

  function Shell() {
    shell++;
    state = useStateLayer('components/bulk-price', wizard, injection, { acl, flags }, sources);
    actor = state.actor;

    return createElement('div', null, createElement(Follower, { wizard: state.actor }));
  }

  const client = createQueryClient();
  const page = (key: string) => createElement(Root, { client, entity: { id: 'shop' } }, createElement(Shell, { key }));
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(page('first'));
  });
  await waitFor(() => expect(actor!.getSnapshot().value).toEqual('choosing'));
  await act(async () => actor!.send({ type: 'next' }));
  fields.set('percent', 0);
  await act(async () => actor!.send({ type: 'next' }));
  expect(actor!.getSnapshot().matches('settingRule')).toBe(true);
  expect(shortcut().available).toBe(false);
  fields.set('percent', 60);
  await act(async () => actor!.send({ type: 'next' }));
  expect(state!.can({ type: 'apply' })).toBe(true);
  expect(shortcut()).toMatchObject({ available: true, label: 'Apply the change' });
  await act(async () => actor!.send({ type: 'apply' }));
  expect(actor!.getSnapshot().matches('confirmingLargeChange')).toBe(true);
  expect(shortcut().available).toBe(true);
  await act(async () => actor!.send({ type: 'back' }));
  fields.set('percent', 20);
  expect(actor!.getSnapshot().matches('previewing')).toBe(true);
  await act(async () => actor!.send({ type: 'apply' }));
  expect(pending).toHaveLength(1);
  expect(shortcut().available).toBe(false);
  const atApply = shell;

  for (let index = 0; index < 9; index++) {
    await act(async () => {
      if (index === 2) pending[index]!.reject(new Error('The server answered 500.'));
      else pending[index]!.resolve();
    });
    expect(progress.at(-1)).toBe(index + 1);
    expect(save).toHaveBeenCalledTimes(Math.min(index + 2, 9));

    if (index < 8) expect(shell).toBe(atApply);
  }

  expect(actor!.getSnapshot().matches('summary')).toBe(true);
  expect(shell).toBeGreaterThan(atApply);
  expect(document.querySelectorAll('li[itemtype="https://schema.org/ReplaceAction"]')).toHaveLength(9);
  expect(document.querySelectorAll('[itemprop="error"]')).toHaveLength(1);

  await act(async () => actor!.send({ type: 'retryFailed' }));
  expect(save).toHaveBeenCalledTimes(10);
  await act(async () => pending[9]!.resolve());
  expect(actor!.getSnapshot().matches('summary')).toBe(true);
  expect(actor!.getSnapshot().context.results).toHaveLength(9);
  expect(document.querySelectorAll('[itemprop="error"]')).toHaveLength(0);

  const previous = actor;
  await act(async () => shown!.rerender(page('second')));
  await waitFor(() => expect(actor!.getSnapshot().value).toEqual('choosing'));
  expect(actor).not.toBe(previous);
  expect(progress.at(-1)).toBe(0);
  expect(document.querySelectorAll('li[itemtype="https://schema.org/ReplaceAction"]')).toHaveLength(0);
});
