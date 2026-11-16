import type { User } from 'framework';
import { messagesOf } from 'framework/testing';

import * as messages from './i18n';
import searchProps from './props';

const i18n = messagesOf(messages);

const shown = (available: boolean, text = 'save', user: null | User = null, onClose: () => void = () => undefined) =>
  // SAFETY: This test supplies every field the search shaper reads; the framework supplies the rest.
  searchProps({
    i18n,
    keyboard: {
      groups: [
        {
          path: 'components/product/editor',
          shortcuts: [{ available, keys: ['mod', 's'], label: 'Save the product', run: () => undefined }],
        },
      ],
    },
    onClose,
    state: {
      can: () => true,
      context: { results: [], text },
      idle: true,
      searching: false,
      send: () => undefined,
      waiting: false,
    },
    title: 'Commands',
    user,
  } as never);

test('a shortcut follows its current availability', () => {
  const command = (available: boolean) => shown(available).sections[0]?.items[0];

  expect(command(false)).toMatchObject({ available: false, label: 'Save the product' });
  expect(command(true)).toMatchObject({ available: true, label: 'Save the product' });
});

test('sign-in follows the current person', () => {
  const signIn = (user: null | User) =>
    shown(true, 'sign', user)
      .sections.flatMap(({ items }) => items)
      .find(({ id }) => id === 'signin');

  expect(signIn(null)).toBeDefined();
  expect(signIn({ firstName: 'Emily', id: 1, image: '', lastName: 'Johnson', username: 'emilys' })).toBeUndefined();
});

test('a command closes before its deferred action, once', async () => {
  vi.useFakeTimers();
  const closed: string[] = [];
  const before = window.location.hash;

  try {
    const command = shown(true, 'states', null, () => closed.push('closed'))
      .sections.flatMap(({ items }) => items)
      .find(({ id }) => id === 'states');

    command?.perform();
    expect(closed).toEqual(['closed']);
    expect(window.location.hash).toBe(before);
    await vi.runAllTimersAsync();
    expect(window.location.hash).toBe('#/states');
  } finally {
    window.location.hash = before;
    vi.useRealTimers();
  }
});
