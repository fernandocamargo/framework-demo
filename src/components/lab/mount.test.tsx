import { act, fireEvent, render } from '@testing-library/react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import type { Entry } from '@/clients/dummyjson/http';
import type { Tracked as TrackedEntry } from '@/clients/tracker';

import { useStateLayer } from '../../../framework/runtime/machine';
import * as network from './components/network/state';
import * as tracked from './components/tracked/state';
import * as lab from './state';

test('only the mounted tab polls, and its poll does not render the lab panel', async () => {
  vi.useFakeTimers();

  let requests = [{ at: 1, id: 1, kind: 'request', text: 'GET /products' }];
  const history = [{ at: 1, event: { id: 2, kind: 'data' } }];
  const activity = vi.fn(() => requests);
  const recent = vi.fn(() => history);
  const clients = { api: { lab: { activity } }, tracker: { recent } };
  const injection = { clients };
  let parentRenders = 0;

  function Network() {
    const state = useStateLayer('components/lab/components/network', network, injection, {}, injection);

    return (
      <ol aria-label="API client">
        {state.context.entries.map((entry: Entry) => (
          <li key={entry.id}>{entry.text}</li>
        ))}
      </ol>
    );
  }

  function Inspector() {
    const state = useStateLayer('components/lab/components/tracked', tracked, injection, {}, injection);

    return (
      <ol aria-label="Inspector">
        {state.context.entries.map((entry: TrackedEntry) => (
          <li key={entry.event.id}>{entry.event.kind}</li>
        ))}
      </ol>
    );
  }

  function Lab() {
    const state = useStateLayer('components/lab', lab, injection, {}, injection);
    const open = Boolean('open' in state && state.open);
    parentRenders += 1;

    return (
      <>
        <button onClick={() => state.send({ type: 'toggle' })}>{open ? 'Close lab' : 'Open lab'}</button>
        {open && (
          <Tabs>
            <TabList aria-label="Activity">
              <Tab id="network">API client</Tab>
              <Tab id="tracked">Inspector</Tab>
            </TabList>
            <TabPanel id="network">
              <Network />
            </TabPanel>
            <TabPanel id="tracked">
              <Inspector />
            </TabPanel>
          </Tabs>
        )}
      </>
    );
  }

  const shown = render(<Lab />);
  expect(activity).not.toHaveBeenCalled();
  expect(recent).not.toHaveBeenCalled();
  fireEvent.click(shown.getByRole('button', { name: 'Open lab' }));

  expect(shown.getByRole('list', { name: 'API client' }).textContent).toContain('GET /products');
  expect(recent).not.toHaveBeenCalled();

  const beforePoll = parentRenders;
  const networkReads = activity.mock.calls.length;
  requests = [...requests, { at: 2, id: 3, kind: 'request', text: 'GET /products/1' }];
  await act(async () => vi.advanceTimersByTimeAsync(1000));

  expect(activity).toHaveBeenCalledTimes(networkReads + 1);
  expect(shown.getByRole('list', { name: 'API client' }).textContent).toContain('GET /products/1');
  expect(parentRenders).toBe(beforePoll);
  expect(recent).not.toHaveBeenCalled();

  fireEvent.click(shown.getByRole('tab', { name: 'Inspector' }));
  expect(shown.getByRole('list', { name: 'Inspector' }).textContent).toContain('data');

  const networkAtHide = activity.mock.calls.length;
  const trackedReads = recent.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(1000));

  expect(activity).toHaveBeenCalledTimes(networkAtHide);
  expect(recent).toHaveBeenCalledTimes(trackedReads + 1);

  requests = [...requests, { at: 3, id: 4, kind: 'request', text: 'GET /products/2' }];
  fireEvent.click(shown.getByRole('tab', { name: 'API client' }));
  expect(shown.getByRole('list', { name: 'API client' }).textContent).toContain('GET /products/2');

  fireEvent.click(shown.getByRole('button', { name: 'Close lab' }));

  const networkAtClose = activity.mock.calls.length;
  const trackedAtClose = recent.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(2000));

  expect(recent).toHaveBeenCalledTimes(trackedAtClose);
  expect(activity).toHaveBeenCalledTimes(networkAtClose);
  shown.unmount();
  vi.useRealTimers();
});
