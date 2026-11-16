import { act, render } from '@testing-library/react';
import { Suspense, use, useLayoutEffect } from 'react';

import type { Http } from '../../../src/clients/dummyjson/http';

test('clients survive every suspended attempt before Root first commits', async () => {
  window.history.replaceState(null, '', '/products?query=%7B%22v%22%3A1%2C%22world%22%3A%22memory%22%7D');
  const factory = vi.spyOn(await import('../../../src/clients/api'), 'default');
  const { Root, useFramework } = await import('../root');
  const { createQueryClient } = await import('../data');
  expect(factory).toHaveBeenCalledTimes(1);
  const client = createQueryClient();
  const attempts: Http[] = [];
  const committed: Http[] = [];

  const gates = Array.from({ length: 3 }, () => {
    let resolve!: () => void;

    const promise = new Promise<void>((done) => {
      resolve = done;
    });

    return { promise, resolve };
  });

  let phase = 0;

  function Reader() {
    const api: Http = useFramework().injection.clients.api;

    if (!attempts.length) api.lab.change({ tokenMinutes: 5 });
    attempts.push(api);
    useLayoutEffect(() => {
      committed.push(api);
    }, [api]);

    return <p>{api.lab.settings().tokenMinutes} minutes</p>;
  }

  function Slow() {
    const gate = gates[phase];

    if (gate) use(gate.promise);

    return null;
  }

  let shown!: ReturnType<typeof render>;
  await act(async () => {
    shown = render(
      <Suspense fallback="waiting">
        <Root client={client} entity={{ id: 'memory' }}>
          <Reader />
        </Root>
        <Slow />
      </Suspense>,
    );
  });

  try {
    for (const gate of gates) {
      expect(shown.container.textContent).toBe('waiting');
      expect(committed).toEqual([]);
      const before = attempts.length;
      await act(async () => {
        phase++;
        gate.resolve();
      });
      expect(attempts.length).toBeGreaterThan(before);
    }

    expect(factory).toHaveBeenCalledTimes(1);
    expect(shown.container.textContent).toBe('5 minutes');
    expect(attempts.length).toBeGreaterThanOrEqual(4);

    for (const api of attempts) expect(api).toBe(attempts[0]);

    expect(committed).toEqual([attempts[0]]);
  } finally {
    shown.unmount();
    client.clear();
    factory.mockRestore();
  }
});
