import type { Navigation, User } from 'framework';
import { messagesOf } from 'framework/testing';

import * as messages from './i18n';
import searchProps from './props';

const i18n = messagesOf(messages);

const shown = (
  available: boolean,
  text = 'save',
  user: null | User = null,
  onClose: () => void = () => undefined,
  navigation?: Pick<Navigation, 'go' | 'query'>,
) =>
  // SAFETY: This test supplies every field the search shaper reads; the framework supplies the rest.
  searchProps({
    i18n,
    keyboard: {
      groups: [
        {
          path: 'components/app/routes/products/components/editor',
          shortcuts: [{ available, keys: ['mod', 's'], label: 'Save the product', run: () => undefined }],
        },
      ],
    },
    navigation,
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

test('the search folder sends page, appearance and sign-in commands through navigation', async () => {
  vi.useFakeTimers();
  const navigation = { go: vi.fn(), query: vi.fn() };
  const onClose = vi.fn();
  const commands = shown(true, '', null, onClose, navigation).sections.flatMap(({ items }) => items);

  try {
    for (const id of ['section:report', 'skin:blueprint', 'locale:pt-BR', 'signin']) {
      commands.find((command) => command.id === id)!.perform();
    }

    expect(onClose).toHaveBeenCalledTimes(4);
    expect(navigation.go).not.toHaveBeenCalled();
    expect(navigation.query).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(navigation.go).toHaveBeenCalledExactlyOnceWith('/report');
    expect(navigation.query.mock.calls).toEqual([
      [{ skin: 'blueprint' }, { replace: true }],
      [{ lang: 'pt-BR' }, { replace: true }],
      [{ signin: true }],
    ]);
  } finally {
    vi.useRealTimers();
  }
});
