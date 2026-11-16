import { act, fireEvent } from '@testing-library/react';
import { createElement } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { shareElements } from '../elements';
import type { Site } from '../pipeline';
import { Root } from '../root';
import { entity, settle, show, viewOf } from '../testing';
import { track } from '../track';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

const site = (prop: string): Site =>
  ({
    column: 1,
    element: 'button',
    file: 'render.tsx',
    id: `components/list#button.${prop}`,
    line: 1,
    path: 'components/list',
    prop,
  }) as Site;
const ROW = site('onClick');
const TITLE = site('onFocus');

test('an element equal to the last one is that element; a changed part takes the rest along', () => {
  const before = createElement(
    'div',
    { className: 'a' },
    createElement('b', null, 'one'),
    createElement('i', { style: { color: 'red' } }, 'two'),
  );
  const same = createElement(
    'div',
    { className: 'a' },
    createElement('b', null, 'one'),
    createElement('i', { style: { color: 'red' } }, 'two'),
  );
  expect(shareElements(before, same)).toBe(before);

  const changed = createElement(
    'div',
    { className: 'a' },
    createElement('b', null, 'one'),
    createElement('i', { style: { color: 'blue' } }, 'two'),
  );
  type Parent = { props: { children: unknown[] } };
  const shared = shareElements(before, changed) as Parent;
  const shown = (before as unknown as Parent).props.children;
  expect(shared).not.toBe(before);
  // The part that did not change is the element shown before.
  expect(shared.props.children[0]).toBe(shown[0]);
  expect(shared.props.children[1]).not.toBe(shown[1]);

  // Keyed items are matched by key, wherever they moved.
  const list = [createElement('li', { key: 'x' }, 'x'), createElement('li', { key: 'y' }, 'y')];
  const moved = shareElements(list, [
    createElement('li', { key: 'y' }, 'y'),
    createElement('li', { key: 'x' }, 'x'),
  ]) as unknown[];
  expect(moved[0]).toBe(list[1]);
  expect(moved[1]).toBe(list[0]);
});

test('a handler is the same from render to render and calls the one React committed, for its own row; React skips what did not change', async () => {
  const clicked: string[] = [];
  let probes = 0;
  function Probe() {
    probes++;
    return createElement('hr');
  }
  const List = component({
    path: 'components/list',
    skins: {},
    view: viewOf<{ items: string[] }>(({ items }) =>
      createElement(
        'div',
        null,
        createElement(Probe),
        // No key on the button: its handler is told apart by its place among the rows.
        items.map((item) =>
          createElement(
            'p',
            { key: item },
            createElement('button', { onClick: track(() => clicked.push(item), ROW) }, item),
          ),
        ),
        createElement('input', { 'aria-label': 'Title', onFocus: track(() => clicked.push('focus'), TITLE) }),
      ),
    ),
  });
  const client = createQueryClient();
  const tree = (items: string[]) => createElement(Root, { client, entity }, createElement(List, { items }));
  const shown = await show(tree(['a', 'b']));
  const container = shown.container;
  const input = () => container.querySelector('input')!;
  const handler = () => Object.entries(input()).find(([key]) => key.startsWith('__reactProps$'))![1].onFocus as unknown;
  const first = handler();
  expect(probes).toBe(1);

  // The rows change order: the list renders, the probe and the input do not change, and each button
  // calls the closure of the row it shows.
  await act(async () => shown.rerender(tree(['b', 'a'])));
  await settle();
  expect(probes).toBe(1);
  expect(handler()).toBe(first);
  const buttons = [...container.querySelectorAll('button')];
  expect(buttons.map((button) => button.textContent)).toEqual(['b', 'a']);
  fireEvent.click(buttons[0]!);
  fireEvent.click(buttons[1]!);
  fireEvent.focus(input());
  expect(clicked).toEqual(['b', 'a', 'focus']);
});

test('a handler outside an instance, in a placeholder or an error file, is wrapped per handler', () => {
  const one = () => 1;
  const two = () => 2;
  expect(track(one, ROW)).toBe(track(one, ROW));
  expect(track(one, ROW)).not.toBe(track(two, ROW));
  expect((track(two, ROW) as () => number)()).toBe(2);
});
