/**
 * A render's output, sharing what did not change with the last output of the same instance. An
 * element equal to the one rendered before at the same place (same type and key, every prop the
 * same value or an equal element, list, or plain object) is that element, so React skips it and
 * everything inside it: typing in one field renders that field, not the dialog around it. A
 * handler is the same value from render to render (track.ts), so it does not stop the sharing.
 */

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (Object.prototype.toString.call(value) !== '[object Object]' || isValidElement(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

/**
 * `element` with these props. Children written side by side (JSX gives them as a frozen array)
 * go back as arguments, as JSX gives them, so React does not take them for a list without keys.
 */
function rebuilt(element: ReactElement<Record<string, unknown>>, props: Record<string, unknown>) {
  const { children, ...rest } = props;
  return Array.isArray(children) && Object.isFrozen(element.props['children'])
    ? cloneElement(element, rest, ...(children as ReactNode[]))
    : cloneElement(element, props);
}

const keyOf = (item: unknown) => (isValidElement(item) && item.key !== null ? item.key : undefined);

function shareList(previous: unknown[], next: unknown[]): unknown[] {
  // A keyed element is matched with the one of the same key, wherever it was; the rest by place.
  const byKey = new Map<string, unknown>();
  for (const item of previous) {
    const key = keyOf(item);
    if (key !== undefined) byKey.set(key, item);
  }
  let same = previous.length === next.length;
  let changed = false;
  const shared = next.map((item, index) => {
    const key = keyOf(item);
    const before = key === undefined ? previous[index] : byKey.get(key);
    const result = shareElements(before, item);
    if (result !== previous[index]) same = false;
    if (result !== item) changed = true;
    return result;
  });
  return same ? previous : changed ? shared : next;
}

function shareProps(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const keys = Object.keys(next);
  let same = keys.length === Object.keys(previous).length;
  let changed = false;
  const shared: Record<string, unknown> = {};
  for (const key of keys) {
    const result = Object.hasOwn(previous, key) ? shareElements(previous[key], next[key]) : next[key];
    shared[key] = result;
    if (!Object.hasOwn(previous, key) || result !== previous[key]) same = false;
    if (result !== next[key]) changed = true;
  }
  return { changed, same, shared };
}

export function shareElements(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next)) return previous;
  if (Array.isArray(previous) && Array.isArray(next)) return shareList(previous, next);
  if (isValidElement(previous) && isValidElement(next)) {
    if (previous.type !== next.type || previous.key !== next.key) return next;
    const { changed, same, shared } = shareProps(
      previous.props as Record<string, unknown>,
      next.props as Record<string, unknown>,
    );
    return same ? previous : changed ? rebuilt(next as ReactElement<Record<string, unknown>>, shared) : next;
  }
  if (isPlainObject(previous) && isPlainObject(next)) {
    const { changed, same, shared } = shareProps(previous, next);
    return same ? previous : changed ? shared : next;
  }
  return next;
}
