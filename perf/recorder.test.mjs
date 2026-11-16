import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React, { act, useState } from 'react';

const recorder = readFileSync(new URL('./recorder.js', import.meta.url), 'utf8');

function page(markup) {
  const window = new JSDOM(markup, { runScripts: 'outside-only' }).window;
  window.eval(recorder);
  const element = window.document.body.firstElementChild;
  const root = { current: {} };

  const fiber = {
    actualDuration: 0,
    alternate: null,
    child: null,
    flags: 1,
    memoizedProps: {},
    return: root.current,
    subtreeFlags: 0,
    tag: 0,
    type: function Control() {},
  };

  element.__reactFiber$test = fiber;
  root.current.child = fiber;

  const commit = () => {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot(1, root);
    fiber.alternate = { child: null, memoizedProps: fiber.memoizedProps };

    return window.__renders.at(-1).components[0].dom;
  };

  commit(); // React's first mount gives the recorder its starting property values.

  return { commit, element, window };
}

test('a native selection changed before its controlled commit changes the page', () => {
  const { commit, element } = page(
    '<select><option value="name">Name</option><option value="price">Price</option></select>',
  );

  element.value = 'price';
  assert.equal(commit(), true);
  element.value = 'price';
  assert.equal(commit(), false);
});

test('a select with duplicate values still counts a different selected index', () => {
  const { commit, element } = page(
    '<select><option value="same">First</option><option value="same">Second</option></select>',
  );

  element.selectedIndex = 1;
  assert.equal(element.value, 'same');
  assert.equal(commit(), true);
});

test('typing into a controlled input changes the page at its commit', () => {
  const { commit, element } = page('<input value="">');
  element.value = 'a';
  assert.equal(commit(), true);
  element.value = 'a';
  assert.equal(commit(), false);
});

test('checking a native checkbox changes the page at its commit', () => {
  const { commit, element } = page('<input type="checkbox">');
  element.checked = true;
  assert.equal(commit(), true);
  assert.equal(commit(), false);
});

test('an option selected without changing an attribute is observed', () => {
  const { commit, element } = page('<option value="price">Price</option>');
  element.selected = true;
  assert.equal(commit(), true);
});

test('text and attributes retain their existing change detection', () => {
  const { commit, element } = page('<div title="old">old</div>');
  element.firstChild.data = 'new';
  assert.equal(commit(), true);
  element.setAttribute('title', 'new');
  assert.equal(commit(), true);
  element.setAttribute('title', 'new');
  assert.equal(commit(), false);
});

test('a user choice in a controlled native select changes its React commit', async () => {
  const window = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, runScripts: 'outside-only' }).window;
  globalThis.window = window;
  globalThis.document = window.document;
  window.eval(recorder);
  globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import('react-dom/client');
  const root = createRoot(window.document.getElementById('root'));

  function Control() {
    const [value, setValue] = useState('name');

    return React.createElement(
      'select',
      { onChange: (event) => setValue(event.target.value), value },
      React.createElement('option', { value: 'name' }, 'Name'),
      React.createElement('option', { value: 'price' }, 'Price'),
    );
  }

  await act(async () => root.render(React.createElement(Control)));

  const select = window.document.querySelector('select');
  const mutations = [];
  const observer = new window.MutationObserver((records) => mutations.push(...records));
  observer.observe(select, { attributes: true, characterData: true, childList: true, subtree: true });
  const before = window.__renders.length;

  select.value = 'price';
  await act(async () => select.dispatchEvent(new window.Event('change', { bubbles: true })));

  assert.equal(select.value, 'price');
  assert.equal(window.__renders.length, before + 1);
  assert.equal(window.__renders.at(-1).components.find((component) => component.name === 'Control').dom, true);
  assert.deepEqual([...mutations, ...observer.takeRecords()], []);
});
