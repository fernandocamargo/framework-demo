import type { useSelector } from '@xstate/react';

import type { serve } from '../../../src/components/lab/components/flags/async';
import type { AsyncProps, Operation, OperationWith, RenderProps } from '../index';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

declare function expect<T extends true>(): T;

declare const command: Operation<string>;
declare const withArgs: OperationWith<[id: number], string>;

expect<Equal<ReturnType<typeof command>, Promise<string>>>();

expect<Equal<Parameters<typeof withArgs>, [id: number]>>();

// @ts-expect-error Status belongs to the actor, not the command.
void command.pending;

declare const flags: AsyncProps<{ serve: typeof serve }>;

expect<Equal<typeof flags.serve, ReturnType<typeof serve>>>();

flags.serve('stockCount', 'everyone');

// @ts-expect-error A way for a different flag cannot be sent to stockCount.
flags.serve('stockCount', 'off');

// @ts-expect-error Commands do not expose status.
void flags.serve.pending;

type Layer = {
  default: () => Promise<string>;
  save: () => (id: number) => Promise<{ id: number }>;
};

declare const given: RenderProps<{ async: Layer }>;

expect<Equal<typeof given.async.default, string>>();

expect<Equal<ReturnType<typeof given.async.save>, Promise<{ id: number }>>>();

expect<Equal<typeof given.status.save.data, undefined | { id: number }>>();

expect<Equal<typeof given.status.save.error, Error | undefined>>();

expect<Equal<typeof given.status.save.pending, boolean>>();

declare const select: typeof useSelector;
const data = select(given.status.save.actor, (snapshot) => snapshot.context.data);

expect<Equal<typeof data, undefined | { id: number }>>();

// @ts-expect-error The default export is a query, not an operation.
void given.status.default;

// @ts-expect-error Owned status is immutable.
given.status.save.pending = true;

// @ts-expect-error Observation does not provide a typed send capability.
given.status.save.actor.send({ type: 'WATCH' });

// @ts-expect-error Observation does not provide a typed stop capability.
given.status.save.actor.stop();
