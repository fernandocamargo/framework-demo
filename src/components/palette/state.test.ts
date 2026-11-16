import { startFlow } from 'framework/testing';

import * as palette from './state';

test('opening and closing the palette keeps only the dialog state', () => {
  const flow = startFlow(palette);
  expect(flow.states).toEqual(['closed']);
  flow.send({ type: 'open' });
  expect(flow.states).toEqual(['open']);
  flow.send({ type: 'close' });
  expect(flow.states).toEqual(['closed']);
  flow.stop();
});
