import { renderToStaticMarkup } from 'react-dom/server';

import type { Entry } from '@/clients/dummyjson/http';
import type { Tracked as TrackedEntry } from '@/clients/tracker';
import { startFlow } from 'framework/testing';

import Network from './components/network/render';
import * as network from './components/network/state';
import Tracked from './components/tracked/render';
import * as tracked from './components/tracked/state';
import * as lab from './state';

beforeEach(() => vi.useFakeTimers());

afterEach(() => vi.useRealTimers());

test('the visible lists read at mount, poll each second, and keep source history across a hide', async () => {
  const request = { at: 1, id: 1, kind: 'request', text: 'GET /products' } satisfies Entry;

  const interaction = {
    at: 1,
    event: {
      action: 'write',
      at: 1,
      id: 2,
      kind: 'data',
      path: 'products.setStock',
      route: '#/products',
    },
  } satisfies TrackedEntry;

  const requests: Entry[] = [request];
  const history = [interaction];
  const activity = vi.fn(() => requests);
  const recent = vi.fn(() => history);
  const clients = { api: { lab: { activity } }, tracker: { recent } };
  const parent = startFlow(lab, { clients });
  parent.send({ type: 'toggle' });

  const networkTab = startFlow(network, { clients });
  expect(networkTab.context['entries']).toEqual([request]);
  expect(recent).not.toHaveBeenCalled();

  const networkFrame = renderToStaticMarkup(
    <Network
      className="network"
      entries={[{ ...request, status: 'https://schema.org/CompletedActionStatus', when: '00:00:01' }]}
      label="The API client's latest requests"
      none="No request yet."
    />,
  );

  expect(networkFrame).toContain('GET /products');
  expect(networkFrame).not.toContain('No request yet.');

  const firstReads = activity.mock.calls.length;
  await vi.advanceTimersByTimeAsync(999);
  expect(activity).toHaveBeenCalledTimes(firstReads);
  await vi.advanceTimersByTimeAsync(1);
  const networkReads = activity.mock.calls.length;
  expect(networkReads).toBe(firstReads + 1);
  expect(recent).not.toHaveBeenCalled();
  networkTab.stop();
  await vi.advanceTimersByTimeAsync(2000);
  expect(activity).toHaveBeenCalledTimes(networkReads);
  expect(recent).not.toHaveBeenCalled();

  const trackedTab = startFlow(tracked, { clients });
  expect(trackedTab.context['entries']).toEqual([interaction]);

  const trackedFrame = renderToStaticMarkup(
    <Tracked
      className="tracked"
      entries={[
        {
          byPerson: false,
          id: interaction.event.id,
          kind: 'write',
          status: 'https://schema.org/PotentialActionStatus',
          text: 'products.setStock',
          when: '00:00:01',
          where: 'sent',
        },
      ]}
      label="What the app did, latest first"
      none="Nothing yet."
    />,
  );

  expect(trackedFrame).toContain('products.setStock');
  expect(trackedFrame).not.toContain('Nothing yet.');
  const trackedReads = recent.mock.calls.length;
  await vi.advanceTimersByTimeAsync(999);
  expect(recent).toHaveBeenCalledTimes(trackedReads);
  await vi.advanceTimersByTimeAsync(1);
  expect(recent).toHaveBeenCalledTimes(trackedReads + 1);
  expect(activity).toHaveBeenCalledTimes(networkReads);
  trackedTab.stop();
  const hiddenReads = recent.mock.calls.length;
  await vi.advanceTimersByTimeAsync(2000);
  expect(recent).toHaveBeenCalledTimes(hiddenReads);

  activity.mockReturnValue([request, { at: 2, id: 3, kind: 'refresh', text: 'POST /refresh' }]);
  recent.mockReturnValue([interaction, { ...interaction, at: 2 }]);
  const shownAgain = startFlow(network, { clients });
  expect(shownAgain.context['entries']).toHaveLength(2);
  shownAgain.stop();
  const inspectorAgain = startFlow(tracked, { clients });
  expect(inspectorAgain.context['entries']).toHaveLength(2);
  inspectorAgain.stop();

  parent.send({ type: 'toggle' });
  expect(parent.states).toEqual(['closed']);
  parent.stop();
});
