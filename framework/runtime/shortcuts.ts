/**
 * The keyboard layer: a component folder's `shortcuts.ts`.
 *
 * Its default export gets what `props.ts` gets (`i18n`, `acl`, `state`, `async`…) and returns the
 * keys the component answers while it is on screen, each with what it says and what it does:
 *
 *   export default ({ i18n, acl }) => ({
 *     'mod+s': { label: i18n.keys.save, send: 'save' },                 // an event of the chart
 *     '/': { label: i18n.keys.search, focus: 'input[type=search]' },     // an element of the component
 *     n: { label: i18n.keys.create, run: () => go({ create: true }), when: acl.allowed },
 *   })
 *
 * - `send` sends an event of the component's chart. The key works only while the chart takes that
 *   event in the state it is in, so a chart declared without `save` (a read-only editor) or in a
 *   state with no `save` (a save running) leaves the key without effect.
 * - `focus` focuses the first element of the component that matches the selector.
 * - `run` calls the function.
 * - `when`, true when left out, says whether the key may be used now.
 * - `mod` is ⌘ on Apple devices and Ctrl elsewhere.
 *
 * One listener on the document. A key goes to the components that can be reached: an element
 * with the component's class is on screen, and nothing hides it (`inert`, `aria-hidden`, which a
 * modal dialog sets on everything outside it). A key without a modifier is left to the field
 * that has the focus, so typing `/` in a search types it. When two components answer the same
 * key, the one that holds the focus wins, then the one shown last. A key some component on screen
 * declares is the app's: the browser's own action (`mod+s` saving the page) does not run, even
 * when the key has no effect now.
 *
 * A key that runs is an interaction, tracked like a handler with its place in `shortcuts.ts`.
 * The keys on screen, translated, with whether each works now, are what a component gets as
 * `keyboard`, for a list of them.
 */

import { useId, useLayoutEffect, useSyncExternalStore } from 'react';

import { report, type Scope, type Site } from './pipeline';
import { track, withScope } from './track';

/** One key of a `shortcuts.ts`, as it declares it. */
type Declared = { focus?: unknown; label?: unknown; run?: unknown; send?: unknown; when?: unknown };

type Combo = { alt: boolean; ctrl: boolean; key: string; mod: boolean; shift: boolean | null };

/** One key as the framework keeps it: when it applies, whether it works now, and what it does. */
export type Entry = { act: () => void; available: boolean; combo: Combo; keys: string; label: string };

/** The places of each key in a folder's `shortcuts.ts`, from the plugin. */
export type ShortcutSites = Record<string, Site>;

/** What a component that reads `keyboard` gets: the keys on screen, by component. */
export type Keyboard = {
  readonly groups: readonly {
    /** The component's folder path. */
    readonly path: string;
    readonly shortcuts: readonly {
      /** Whether the key does something now. */
      readonly available: boolean;
      /** The keys as the platform writes them: `['⌘', 'S']` on Apple devices, `['Ctrl', 'S']` elsewhere. */
      readonly keys: readonly string[];
      readonly label: string;
      /** Does what the key does, if it does something now. */
      readonly run: () => void;
    }[];
  }[];
};

const APPLE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

function comboOf(keys: string): Combo {
  // `mod++` is the plus key with a modifier; any other `+` separates.
  const parts = keys.endsWith('++') ? [...keys.slice(0, -2).split('+'), '+'] : keys.split('+');
  const key = (parts.pop() ?? '').toLowerCase();
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));
  // A symbol (`?`, `/`, `[`) is typed with or without shift depending on the layout: shift is not checked.
  const symbol = key.length === 1 && !/[a-z0-9]/.test(key);
  return {
    alt: modifiers.has('alt'),
    ctrl: modifiers.has('ctrl'),
    key,
    mod: modifiers.has('mod'),
    shift: symbol ? null : modifiers.has('shift'),
  };
}

const matches = (combo: Combo, event: KeyboardEvent) =>
  event.key.toLowerCase() === combo.key &&
  event.metaKey === (combo.mod && APPLE) &&
  event.ctrlKey === (combo.ctrl || (combo.mod && !APPLE)) &&
  event.altKey === combo.alt &&
  (combo.shift === null || event.shiftKey === combo.shift);

const NAMES: Record<string, string> = {
  ' ': 'Space',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  enter: 'Enter',
  escape: 'Esc',
};

/** The keys as the platform writes them. */
function shown(combo: Combo): string[] {
  const parts: string[] = [];
  if (combo.ctrl) parts.push(APPLE ? '⌃' : 'Ctrl');
  if (combo.mod) parts.push(APPLE ? '⌘' : 'Ctrl');
  if (combo.alt) parts.push(APPLE ? '⌥' : 'Alt');
  if (combo.shift) parts.push(APPLE ? '⇧' : 'Shift');
  parts.push(
    NAMES[combo.key] ??
      (combo.key.length === 1 ? combo.key.toUpperCase() : combo.key[0]!.toUpperCase() + combo.key.slice(1)),
  );
  return parts;
}

/** Whether keys typed here are text: a key without a modifier is then the field's. */
function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)
    return true;
  return (
    target instanceof HTMLInputElement &&
    !['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'].includes(target.type)
  );
}

/** On screen, and not hidden from people by a dialog over it. */
const reachable = (element: Element) =>
  element.isConnected &&
  !element.closest('[inert], [aria-hidden="true"]') &&
  (element as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility?.() !== false;

/** The component's elements that can be reached: the ones with its class. */
const elementsOf = (path: string) => [...document.getElementsByClassName(path)].filter(reachable);

// ---- The keys of one component instance ------------------------------------------------------

const sitesByPath = new Map<string, Map<string, Site>>();

/** Where a key was declared, as an interaction's site: from the plugin, or the file alone. */
function siteOf(path: string, keys: string, sites: ShortcutSites | undefined, what: string): Site {
  const given = sites?.[keys];
  if (given) return given;
  let byKeys = sitesByPath.get(path);
  if (!byKeys) sitesByPath.set(path, (byKeys = new Map()));
  let site = byKeys.get(keys);
  if (!site)
    byKeys.set(
      keys,
      (site = Object.freeze({
        column: 0,
        element: 'shortcuts',
        file: `${path}/shortcuts.ts`,
        handler: what,
        id: `${path}#shortcuts.${keys}`,
        line: 0,
        path,
        prop: keys,
      })),
    );
  return site;
}

type StateLike = undefined | { can?: (event: { type: string }) => boolean; send?: (event: { type: string }) => void };

/**
 * The keys a component instance answers, from its `shortcuts.ts` and what it is given. A key
 * whose declaration cannot work (a `send` in a folder with no chart) is reported, and listed as
 * not available.
 */
export function shortcutsOf(
  path: string,
  module: { default?: unknown },
  given: Record<string, unknown>,
  state: StateLike,
  scope: Scope,
  sites?: ShortcutSites,
): Entry[] {
  const declare = module.default;
  if (typeof declare !== 'function') return [];
  let declared: Record<string, Declared>;
  try {
    declared = ((declare as (given: unknown) => unknown)(given) ?? {}) as Record<string, Declared>;
  } catch (thrown) {
    report(thrown, { layer: 'shortcuts', path });
    return [];
  }
  return withScope(scope, () =>
    Object.entries(declared).map(([keys, value]) => {
      const when = value.when === undefined ? true : Boolean(value.when);
      const label = String(value.label ?? keys);
      let available = when;
      let act: () => void = () => undefined;
      let what = 'run';
      if (value.send !== undefined) {
        const event = typeof value.send === 'string' ? { type: value.send } : (value.send as { type: string });
        what = `send ${event.type}`;
        if (!state?.send) {
          report(new Error(`${path}/shortcuts.ts: "${keys}" sends ${event.type}, but the folder has no state.ts`), {
            layer: 'shortcuts',
            path,
          });
          available = false;
        } else {
          available = when && (state.can?.(event) ?? true);
          const send = state.send;
          act = () => send(event);
        }
      } else if (typeof value.focus === 'string') {
        const selector = value.focus;
        what = `focus ${selector}`;
        act = () => {
          const elements = elementsOf(path);
          const holding = elements.find((element) => element.contains(document.activeElement)) ?? elements[0];
          const target = holding && (holding.matches(selector) ? holding : holding.querySelector(selector));
          if (!(target instanceof HTMLElement)) return;
          target.focus();
          if (target instanceof HTMLInputElement) target.select();
        };
      } else if (typeof value.run === 'function') {
        act = value.run as () => void;
      }
      const site = siteOf(path, keys, sites, what);
      return { act: track(act, site), available, combo: comboOf(keys), keys, label };
    }),
  );
}

// ---- What is on screen ------------------------------------------------------------------------

type Registration = { entries: readonly Entry[]; order: number; path: string; scope: Scope };

/** By instance: each one's `useId`. */
const registrations = new Map<string, Registration>();
let shownSoFar = 0;
let keyboard: Keyboard = Object.freeze({ groups: Object.freeze([]) });
let signature = '';
const listeners = new Set<() => void>();

/**
 * Does what pressing the key does, for a list of keys (a palette, a menu): the folder's entry that
 * is available now, looked up in the registrations as they stand, so a component that left or
 * changed its keys runs nothing stale. Of two instances of a folder, the last shown runs, as
 * pressing does. It does not ask whether the component can be reached: a palette runs keys while
 * its own dialog hides the page. A `focus` key still needs its element reachable to focus it.
 */
function runKey(path: string, keys: string) {
  for (const registration of [...registrations.values()].sort((a, b) => b.order - a.order)) {
    if (registration.path !== path) continue;
    const entry = registration.entries.find((known) => known.keys === keys && known.available);
    if (entry) return entry.act();
  }
}

/** The keys on screen, by component, in the order the components were shown; one group per folder. */
function update() {
  const byPath = new Map<string, Map<string, { available: boolean; keys: string[]; label: string; run: () => void }>>();
  for (const { entries, path } of [...registrations.values()].sort((a, b) => a.order - b.order)) {
    let group = byPath.get(path);
    if (!group) byPath.set(path, (group = new Map()));
    for (const entry of entries) {
      const known = group.get(entry.keys);
      // Two instances of a folder: one entry, available when either's is.
      if (known) known.available ||= entry.available;
      else
        group.set(entry.keys, {
          available: entry.available,
          keys: shown(entry.combo),
          label: entry.label,
          run: () => runKey(path, entry.keys),
        });
    }
  }
  const groups = [...byPath]
    .filter(([, group]) => group.size > 0)
    .map(([path, group]) => ({ path, shortcuts: [...group.values()] }));
  const next = JSON.stringify(groups);
  if (next === signature) return;
  signature = next;
  keyboard = Object.freeze({ groups: Object.freeze(groups) });
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const current = () => keyboard;

/** The keys on screen, for a component that reads `keyboard`: it renders again when they change. */
export const useKeyboard = () => useSyncExternalStore(subscribe, current, current);

/**
 * Keeps a component instance's keys registered while it is mounted. `entries` is read after each
 * commit: the keys of what is on screen.
 */
export function useShortcuts(path: string, scope: Scope, entries: { readonly current: readonly Entry[] | undefined }) {
  const token = useId();
  useLayoutEffect(() => {
    if (!entries.current) return;
    const known = registrations.get(token);
    if (known?.entries === entries.current && known.scope === scope) return;
    registrations.set(token, { entries: entries.current, order: known?.order ?? ++shownSoFar, path, scope });
    update();
  });
  useLayoutEffect(
    () => () => {
      if (registrations.delete(token)) update();
    },
    [token],
  );
}

// ---- The listener -----------------------------------------------------------------------------

const depth = (scope: Scope) => {
  let count = 0;
  for (let node: null | Scope = scope; node; node = node.parent) count++;
  return count;
};

function onKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.repeat) return;
  const inField = typing(event.target);
  const focused = document.activeElement;
  const candidates: { depth: number; entry: Entry; holdsFocus: boolean; order: number }[] = [];
  for (const registration of registrations.values()) {
    for (const entry of registration.entries) {
      if (!matches(entry.combo, event)) continue;
      if (inField && !entry.combo.mod && !entry.combo.ctrl && !entry.combo.alt) continue;
      const elements = elementsOf(registration.path);
      if (!elements.length) continue;
      const holdsFocus = focused !== null && elements.some((element) => element.contains(focused));
      candidates.push({ depth: depth(registration.scope), entry, holdsFocus, order: registration.order });
    }
  }
  if (!candidates.length) return;
  candidates.sort(
    (a, b) =>
      Number(b.holdsFocus) - Number(a.holdsFocus) || (a.holdsFocus ? b.depth - a.depth : 0) || b.order - a.order,
  );
  event.preventDefault();
  candidates.find(({ entry }) => entry.available)?.entry.act();
}

/** Listens to the keyboard for the components on screen. Returns what stops listening. */
export function listenToKeys() {
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
