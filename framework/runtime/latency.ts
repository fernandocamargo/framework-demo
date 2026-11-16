import { and, assign, setup } from 'xstate';

type Settled = 'fulfilled' | 'idle' | 'rejected';

type Context = {
  data: unknown;
  error: Error | undefined;
  lastError: Error | undefined;
  latest: AbortController | undefined;
  running: readonly AbortController[];
  settled: Settled;
};

type Event =
  | { call: AbortController; data: unknown; type: 'RESOLVE' }
  | { call: AbortController; error: Error; type: 'REJECT' }
  | { call: AbortController; type: 'ABORT' }
  | { call: AbortController; type: 'FINISH' }
  | { call: AbortController; type: 'WATCH' };

export const latency = setup({
  actions: {
    abort: assign(({ context, event }) => ({
      error: context.lastError,
      latest: undefined,
      running: context.running.filter((call) => call !== event.call),
    })),
    finish: assign({ running: ({ context, event }) => context.running.filter((call) => call !== event.call) }),
    reject: assign({
      error: ({ event }) => (event.type === 'REJECT' ? event.error : undefined),
      lastError: ({ event }) => (event.type === 'REJECT' ? event.error : undefined),
      settled: 'rejected',
    }),
    resolve: assign({
      data: ({ event }) => (event.type === 'RESOLVE' ? event.data : undefined),
      error: undefined,
      lastError: undefined,
      settled: 'fulfilled',
    }),
    watch: assign(({ context, event }) => ({
      error: undefined,
      latest: event.call,
      running: [...context.running, event.call],
    })),
  },
  guards: {
    latest: ({ context, event }) => context.latest === event.call,
    wasFulfilled: ({ context }) => context.settled === 'fulfilled',
    wasIdle: ({ context }) => context.settled === 'idle',
  },
  // SAFETY: XState reads these placeholders only as types; the machine below supplies the runtime context and events.
  types: { context: {} as Context, events: {} as Event },
}).createMachine({
  context: {
    data: undefined,
    error: undefined,
    lastError: undefined,
    latest: undefined,
    running: [],
    settled: 'idle',
  },
  initial: 'idle',
  on: { ABORT: { actions: 'finish' }, FINISH: { actions: 'finish' } },
  states: {
    idle: { on: { WATCH: { actions: 'watch', target: 'pending' } } },
    pending: {
      on: {
        ABORT: [
          { actions: 'abort', guard: and(['latest', 'wasIdle']), target: 'idle' },
          { actions: 'abort', guard: and(['latest', 'wasFulfilled']), target: 'fulfilled' },
          { actions: 'abort', guard: 'latest', target: 'rejected' },
          { actions: 'finish' },
        ],
        REJECT: { actions: 'reject', guard: 'latest', target: 'rejected' },
        RESOLVE: { actions: 'resolve', guard: 'latest', target: 'fulfilled' },
        WATCH: { actions: 'watch' },
      },
    },
    fulfilled: { on: { WATCH: { actions: 'watch', target: 'pending' } } },
    rejected: { on: { WATCH: { actions: 'watch', target: 'pending' } } },
  },
});
