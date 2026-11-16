import { act, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';

// Load the event destination before the framework's clients.
import '@/clients/tracker';
import { createQueryClient, Root, whenIdle } from 'framework';
import { messagesOf, startFlow } from 'framework/testing';

import Lab from '.';
import { forceStatus, setTokenMinutes } from './handlers';
import * as messages from './i18n';
import portuguese from './i18n/pt-BR.json';
import labProps from './props';
import * as lab from './state';

test('pointer activation focuses every lab radio, including an already selected choice', async () => {
  const client = createQueryClient();
  let shown!: ReturnType<typeof render>;
  await act(async () => {
    shown = render(
      createElement(
        Root,
        { client, entity: { id: 'memory' }, env: { apiUrl: '', world: 'memory' } },
        createElement(Lab),
      ),
    );
  });

  try {
    await shown.findByRole('button', { name: 'Network lab' }, { timeout: 5000 });
    await act(whenIdle);
    await act(async () => fireEvent.click(shown.getByRole('button', { name: 'Network lab' })));
    await act(whenIdle);

    const radios = shown.getAllByRole('radio');
    expect(radios).toHaveLength(6);
    for (const radio of radios) {
      for (let click = 0; click < 2; click++) {
        radio.focus();
        fireEvent.mouseDown(radio);
        // WebKit's pointer activation blurs a radio without focusing it again.
        radio.blur();
        fireEvent.mouseUp(radio);
        await act(async () => fireEvent.click(radio));
        await act(whenIdle);
        expect(document.activeElement).toBe(radio);
        expect(shown.getAllByRole('radio')).toEqual(radios);
        expect(shown.getAllByRole('radio', { checked: true })).toContain(radio);
      }
    }
  } finally {
    shown.unmount();
    client.clear();
  }
});

test.each([
  ['0', 0],
  ['500', 500],
  ['429', 429],
])('a native force choice %s changes the setting once', async (value, force) => {
  const change = vi.fn();
  // SAFETY: The handler reads only the operation and the input's current value.
  const choose = forceStatus({ async: { change } } as never);
  // SAFETY: This fixture supplies the input value, the only event property read.
  await choose({ currentTarget: { value } } as React.ChangeEvent<HTMLInputElement>);
  expect(change.mock.calls).toEqual([[{ force }]]);
});

test.each(['1', '5', '30'])('a native lifetime choice %s preserves minutes', async (value) => {
  const change = vi.fn();
  // SAFETY: The handler reads only the operation and the input's current value.
  const choose = setTokenMinutes({ async: { change } } as never);
  // SAFETY: This fixture supplies the input value, the only event property read.
  await choose({ currentTarget: { value } } as React.ChangeEvent<HTMLInputElement>);
  expect(change.mock.calls).toEqual([[{ tokenMinutes: Number(value) }]]);
});

test.each(['en', 'pt-BR'])('lab group identities survive setting changes and reopen in %s', (locale) => {
  const first = startFlow(lab);
  const second = startFlow(lab);
  const name = first.context['radioName'];
  const i18n = messagesOf(messages, locale, locale === 'pt-BR' ? portuguese : {}, 'components/lab');
  const settings = { failureRate: 0, force: 0, latency: 0, offline: false, tokenMinutes: 1 };

  const controls = () => {
    // SAFETY: The fixture supplies every input the lab's props read.
    return labProps({
      async: { default: { settings } },
      i18n,
      state: { context: first.context, open: first.states.includes('open') },
    } as never);
  };

  try {
    expect(name).toEqual(expect.any(String));
    expect(name).not.toBe(second.context['radioName']);
    first.send({ type: 'toggle' });
    expect(controls()).toMatchObject({ force: '0', open: true, radioName: name, tokenMinutes: '1' });

    settings.force = 429;
    settings.tokenMinutes = 30;
    expect(controls()).toMatchObject({ force: '429', radioName: name, tokenMinutes: '30' });
    expect(controls().minutes.map((choice) => choice.value)).toEqual(['1', '5', '30']);
    first.send({ type: 'toggle' });
    first.send({ type: 'toggle' });
    expect(controls()).toMatchObject({ force: '429', open: true, radioName: name, tokenMinutes: '30' });
    expect(second.states).toEqual(['closed']);
  } finally {
    first.stop();
    second.stop();
  }
});
