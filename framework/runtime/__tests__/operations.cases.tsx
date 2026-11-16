import { act, render, waitFor } from '@testing-library/react';
import { useSelector } from '@xstate/react';
import { Activity, createElement, type ReactNode, startTransition, Suspense, useMemo } from 'react';

// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import { operationsModule } from '../../plugin/index.mjs';
import { isBusy } from '../activity';
import { type AsyncModule, useOperation } from '../async';
import { bound } from '../boundaries';
import { component, type Spec } from '../component';
import { createQueryClient } from '../data';
import { onFailure } from '../pipeline';
import { Root } from '../root';
import type { Operation } from '../types';

type Manifest = { names: string[]; status: Record<string, string[]> };

type Props = Parameters<Awaited<ReturnType<Spec['view']>>['render']>[0];

type Hook = {
  operationSignature: string;
  useOperations: (
    path: string,
    module: AsyncModule,
    injection: Props,
  ) => {
    commands: Record<string, Operation>;
    status: Record<
      string,
      { actor?: ReturnType<typeof useOperation>[1]; data?: unknown; error?: Error; pending?: boolean }
    >;
  };
};

/** Run the generated hook with the same native hooks as a loaded view module. */
export function wiredOperations(manifest: Manifest): Hook {
  const source: string = operationsModule(manifest, '"framework"');

  const body = source
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')
    .replace(/^export /gm, '');

  return new Function(
    'useOperation',
    'useSelector',
    'useMemo',
    `${body}\nreturn { operationSignature, useOperations };`,
  )(useOperation, useSelector, useMemo);
}

export function cases(mode: string) {
  // SAFETY: These fixtures use only the entity id that keys Root's data.
  const entity = { id: 'shop' } as never;
  const page = (element: ReactNode, client = createQueryClient()) => createElement(Root, { client, entity }, element);

  const deferred = () => {
    let resolve!: (data: string) => void;
    let reject!: (error: Error) => void;

    const promise = new Promise<string>((yes, no) => {
      resolve = yes;
      reject = no;
    });

    return { promise, reject, resolve };
  };

  const folder = (fields: string[], exported: AsyncModule[string], project?: (given: Props) => Props) => {
    const renders = vi.fn((given: Props) => createElement('p', null, JSON.stringify(given.status)));
    const hooks = wiredOperations({ names: ['save'], status: { save: fields } });
    const executions = vi.fn(hooks.useOperations);
    let latest!: ReturnType<Hook['useOperations']>;

    const files = {
      ...hooks,
      async: { save: exported },
      form: undefined,
      props: {
        default: (given: Props) => {
          // SAFETY: The generated hook supplies these two records to shaping.
          latest = { commands: given.async, status: given.status } as typeof latest;

          return project ? project(given) : { status: fields.includes('actor') ? undefined : given.status };
        },
      },
      render: renders,
      state: undefined,
      useOperations: executions,
    };

    const Component = component({
      path: `components/operations-${mode}`,
      reads: { async: ['locale'], view: ['locale'] },
      skins: {},
      view: () => Promise.resolve(files),
    });

    return { Component, executions, files, latest: () => latest, renders };
  };

  test(`${mode}: a command-only owner never executes for status; commands have no mutable status`, async () => {
    const call = deferred();
    const view = folder([], () => call.promise);
    const shown = await act(async () => render(page(bound(createElement(view.Component)))));
    await waitFor(() => expect(view.renders).toHaveBeenCalledTimes(1));
    const command = view.latest().commands.save!;
    const before = view.executions.mock.calls.length;
    let result!: ReturnType<Operation>;
    act(() => {
      result = command();
    });
    expect(view.renders).toHaveBeenCalledTimes(1);
    expect(view.executions).toHaveBeenCalledTimes(before);
    expect(command).not.toHaveProperty('pending');
    expect(view.latest().status).toEqual({});
    await act(async () => {
      call.resolve('saved');
      await expect(result).resolves.toBe('saved');
    });
    expect(view.renders).toHaveBeenCalledTimes(1);
    expect(view.executions).toHaveBeenCalledTimes(before);
    shown.unmount();
  });

  test.each(['pending', 'data', 'error'])(`${mode}: only the selected %s field executes its owner`, async (field) => {
    let call = deferred();
    const view = folder([field], () => call.promise);
    await act(async () => render(page(bound(createElement(view.Component)))));
    await waitFor(() => expect(view.renders).toHaveBeenCalledTimes(1));
    const command = view.latest().commands.save!;
    let result!: ReturnType<Operation>;
    act(() => {
      result = command();
    });
    expect(view.renders).toHaveBeenCalledTimes(field === 'pending' ? 2 : 1);
    await act(async () => {
      call.resolve('saved');
      await result;
    });
    expect(view.renders).toHaveBeenCalledTimes(field === 'pending' ? 3 : field === 'data' ? 2 : 1);
    const after = view.renders.mock.calls.length;
    call = deferred();
    act(() => {
      result = command();
    });
    const error = new Error('refused');
    await act(async () => {
      call.reject(error);
      await expect(result).rejects.toBe(error);
    });
    expect(view.renders).toHaveBeenCalledTimes(after + (field === 'pending' ? 2 : field === 'error' ? 1 : 0));
    expect(view.latest().commands.save).toBe(command);
  });

  test(`${mode}: actor-only observation adds no owner subscription and overlapping calls keep the latest outcome`, async () => {
    const calls = [deferred(), deferred()];
    let next = 0;
    const view = folder(['actor'], () => calls[next++]!.promise);
    await act(async () => render(page(bound(createElement(view.Component)))));
    await waitFor(() => expect(view.renders).toHaveBeenCalledTimes(1));
    const actor = view.latest().status.save!.actor!;
    const before = view.executions.mock.calls.length;
    const first = view.latest().commands.save!();
    const second = view.latest().commands.save!();
    await act(async () => {
      calls[1]!.resolve('latest');
      await second;
      calls[0]!.resolve('older');
      await first;
    });
    expect(actor.getSnapshot().context.data).toBe('latest');
    expect(actor.getSnapshot().context.running).toEqual([]);
    expect(view.renders).toHaveBeenCalledTimes(1);
    expect(view.executions).toHaveBeenCalledTimes(before);
  });

  test(`${mode}: discarded locale input cannot replace a committed command's injection`, async () => {
    const never = new Promise(() => {});
    const seen: string[] = [];

    const exported = ({ locale }: { locale: string }) => {
      seen.push(locale);

      return Promise.resolve(locale);
    };

    // SAFETY: This fixture declares a save command resolving to the captured locale.
    const view = folder([], exported, ({ async, locale }) => ({
      command: (async as { save: () => Promise<string> }).save,
      locale,
    }));

    view.files.render = vi.fn(({ command, locale }: Props) => {
      if (locale === 'pt-BR') throw never;

      // SAFETY: The projection above forwards the generated save command.
      return createElement('button', { onClick: () => void (command as () => Promise<string>)() }, String(locale));
    });
    const client = createQueryClient();

    const content = (locale: string) =>
      createElement(
        Root,
        { client, entity, locale },
        createElement(Suspense, { fallback: 'waiting' }, bound(createElement(view.Component))),
      );

    const shown = await act(async () => render(content('en')));
    await waitFor(() => expect(shown.container.textContent).toBe('en'));
    await act(async () => startTransition(() => shown.rerender(content('pt-BR'))));
    await act(async () => shown.container.querySelector('button')!.click());
    expect(seen).toEqual(['en']);
    await act(async () => shown.rerender(content('fr')));
    await act(async () => shown.container.querySelector('button')!.click());
    expect(seen).toEqual(['en', 'fr']);
  });

  test(`${mode}: Activity aborts through the generated layer without a failure or replay`, async () => {
    const call = deferred();
    let signal!: AbortSignal;
    const failures = vi.fn();
    const off = onFailure(failures);

    const view = folder(['data', 'error', 'pending'], (given: { signal: AbortSignal }) => {
      signal = given.signal;

      return call.promise;
    });

    const client = createQueryClient();

    const content = (mode: 'hidden' | 'visible') =>
      page(createElement(Activity, { children: bound(createElement(view.Component)), mode }), client);

    const shown = await act(async () => render(content('visible')));
    await waitFor(() => expect(view.renders).toHaveBeenCalledTimes(1));
    let result!: ReturnType<Operation>;
    act(() => {
      result = view.latest().commands.save!();
    });
    await act(async () => shown.rerender(content('hidden')));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      call.reject(new DOMException('Cancelled', 'AbortError'));
      await expect(result).rejects.toHaveProperty('name', 'AbortError');
    });
    await act(async () => shown.rerender(content('visible')));
    expect(view.latest().status.save).toEqual({ data: undefined, error: undefined, pending: false });
    expect(failures).not.toHaveBeenCalled();
    expect(isBusy()).toBe(false);
    off();
  });

  test(`${mode}: the query answer and two independent commands share the actual layer`, async () => {
    const calls = [deferred(), deferred()];
    const hooks = wiredOperations({ names: ['erase', 'save'], status: { erase: ['pending'], save: ['pending'] } });

    let given!: {
      async: { default: string; erase: () => ReturnType<Operation>; save: () => ReturnType<Operation> };
      status: { erase: { pending: boolean }; save: { pending: boolean } };
    };

    const View = component({
      path: `components/two-operations-${mode}`,
      skins: {},
      view: () =>
        Promise.resolve({
          ...hooks,
          async: {
            default: () => Promise.resolve('answer'),
            erase: () => calls[0]!.promise,
            save: () => calls[1]!.promise,
          },
          form: undefined,
          props: undefined,
          render: (props: Props) => {
            // SAFETY: This fixture declares both commands, their pending fields and the default query.
            given = props as typeof given;

            return createElement('p', null, given.async.default);
          },
          state: undefined,
        }),
    });

    await act(async () => render(page(bound(createElement(View)))));
    await waitFor(() => expect(given.async.default).toBe('answer'));
    let erased!: ReturnType<Operation>;
    let saved!: ReturnType<Operation>;
    act(() => {
      erased = given.async.erase();
      saved = given.async.save();
    });
    expect([given.status.erase.pending, given.status.save.pending]).toEqual([true, true]);
    await act(async () => {
      calls[0]!.resolve('erased');
      await erased;
    });
    expect([given.status.erase.pending, given.status.save.pending]).toEqual([false, true]);
    await act(async () => {
      calls[1]!.resolve('saved');
      await saved;
    });
    expect([given.status.erase.pending, given.status.save.pending]).toEqual([false, false]);
    expect(given.async.default).toBe('answer');
  });

  test(`${mode}: ACL, handlers and shortcuts receive the selected status before a cache hit`, async () => {
    const call = deferred();
    const hooks = wiredOperations({ names: ['save'], status: { save: ['pending'] } });
    let command!: () => ReturnType<Operation>;
    let handler!: () => Props['status'];
    const shortcut = vi.fn();

    const View = component({
      path: `components/status-inputs-${mode}`,
      reads: { acl: ['status'], view: ['acl', 'status'] },
      skins: {},
      view: () =>
        Promise.resolve({
          ...hooks,
          acl: { default: ({ status }: { status: { save: { pending: boolean } } }) => !status.save.pending },
          async: { save: () => call.promise },
          form: undefined,
          handlers: {
            ['shape']: 'status',
            useHandlers: ({ status }) => useMemo(() => ({ inspect: () => status }), [status]),
          },
          // SAFETY: Root supplies the inherited decision together with this fixture's rule.
          props: { default: ({ acl }: Props) => ({ allowed: (acl as { allowed: boolean }).allowed }) },
          render: ({ allowed, handlers }: Props) => {
            // SAFETY: The handler hook above supplies inspect on every render.
            handler = (handlers as { inspect: typeof handler }).inspect;

            return String(allowed);
          },
          shortcuts: {
            default: (given: { async: { save: typeof command }; status: { save: { pending: boolean } } }) => {
              command = given.async.save;
              shortcut(given.status.save.pending);

              return { 'mod+s': { label: 'Save', run: given.async.save, when: !given.status.save.pending } };
            },
          },
          state: undefined,
        }),
    });

    const shown = await act(async () => render(page(bound(createElement(View)))));
    await waitFor(() => expect(shown.container.textContent).toBe('true'));
    const first = handler;
    let result!: ReturnType<Operation>;
    act(() => {
      result = command();
    });
    expect(shown.container.textContent).toBe('false');
    expect(handler).not.toBe(first);
    expect(handler()).toEqual({ save: { pending: true } });
    expect(shortcut).toHaveBeenLastCalledWith(true);
    await act(async () => {
      call.resolve('saved');
      await result;
    });
    expect(shown.container.textContent).toBe('true');
    expect(handler()).toEqual({ save: { pending: false } });
    expect(shortcut).toHaveBeenLastCalledWith(false);
  });
}
