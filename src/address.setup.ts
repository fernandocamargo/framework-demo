// For a unit test that reads or writes the app's address (it imports this file): the address on
// React Router in memory, with the app's routes matched as the browser's router matches them and
// no folder loaded.
import { createBrowserRouter, createMemoryRouter } from 'react-router';

import { bare } from 'framework/testing';

import { start } from './address';

const inMemory: typeof createBrowserRouter = (routes, options) =>
  createMemoryRouter(bare(routes), { ...options, initialEntries: ['/products'] });
start(() => null, undefined, inMemory);
