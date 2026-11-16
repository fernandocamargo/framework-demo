// A stand-in for React DevTools' global hook, run before the app's scripts (perf/cycles.mjs).
// On every commit it records each component React rendered, with:
// - `mounted`, or why it re-rendered: its own state or a context (`own`), its parent with the
//   same props (`parent`), or the props that changed, each marked `sameValue` when only the
//   reference is new (a function with the same code, an object or element with equal contents);
// - `dom`: whether the commit changed the page anywhere inside it (an attribute, text or live
//   form value that holds another value than before, or a node added or removed). A
//   re-render with `dom: false` changed nothing anyone can see.
//   Each also says which framework component it is `within`, so what react-aria renders can be
//   told apart by the component of ours that holds it.
// It also counts every call of a framework component's render (`window.__renderCall`, from
// perf/vite.config.ts), per step (`window.__phase`), and marks the calls whose output React
// committed (`window.__kept`): a call never marked is a render React threw away.
(() => {
  const PERFORMED_WORK = 1;
  // React's flag on a fiber whose children were removed in this commit, bubbled up as subtreeFlags.
  const CHILD_DELETION = 16;
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]); // function, class, forwardRef, memo, simple memo
  const nameOf = (fiber) => {
    const type = fiber.type;
    if (!type) return 'unknown';
    if (typeof type === 'function') return type.displayName || type.name || 'anonymous';
    const inner = type.render || type.type;
    return type.displayName || (inner && (inner.displayName || inner.name)) || 'anonymous';
  };
  const equal = (a, b, depth = 0) => {
    if (Object.is(a, b)) return true;
    if (typeof a !== typeof b || a === null || b === null) return false;
    if (typeof a === 'function') return a.toString() === b.toString();
    if (typeof a !== 'object' || depth > 4) return false;
    if (a.$$typeof && a.$$typeof === b.$$typeof)
      return a.type === b.type && a.key === b.key && equal(a.props, b.props, depth + 1);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => key !== '_owner' && equal(a[key], b[key], depth + 1));
  };
  const kindOf = (value) =>
    typeof value === 'function'
      ? 'function'
      : value && value.$$typeof
        ? 'element'
        : Array.isArray(value)
          ? 'array'
          : typeof value;
  const why = (fiber) => {
    const previous = fiber.alternate.memoizedProps;
    const next = fiber.memoizedProps;
    if (previous === next) {
      // Which of its hooks hold something new (effects aside), and which contexts it read changed.
      const hooks = [];
      for (
        let a = fiber.alternate.memoizedState, b = fiber.memoizedState, index = 0;
        a && b;
        a = a.next, b = b.next, index++
      ) {
        const value = b.memoizedState;
        const effect = value && typeof value === 'object' && 'create' in value && 'tag' in value;
        if (!effect && !Object.is(a.memoizedState, value)) hooks.push(index);
      }
      const before = new Map();
      for (let dependency = fiber.alternate.dependencies?.firstContext; dependency; dependency = dependency.next)
        before.set(dependency.context, dependency.memoizedValue);
      const contexts = [];
      for (let dependency = fiber.dependencies?.firstContext; dependency; dependency = dependency.next) {
        if (before.has(dependency.context) && !Object.is(before.get(dependency.context), dependency.memoizedValue))
          contexts.push(dependency.context.displayName || 'context');
      }
      return { cause: 'own', contexts, hooks };
    }
    const changed = [];
    for (const key of new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])) {
      if (Object.is(previous[key], next[key])) continue;
      changed.push({ key, kind: kindOf(next[key]), sameValue: equal(previous[key], next[key]) });
    }
    return { cause: changed.length ? 'props' : 'parent', changed };
  };

  // What changed in the page since the last commit, as the fibers it touched and their ancestors.
  const observer = new MutationObserver(() => {});
  // A user changes a control's property before React commits, without a mutation record.
  const controls = new WeakMap();
  // The document itself: as an init script, this runs before the page has an <html> element.
  observer.observe(document, {
    attributeOldValue: true,
    attributes: true,
    characterData: true,
    characterDataOldValue: true,
    childList: true,
    subtree: true,
  });
  const fiberOf = (node) => {
    for (let current = node; current; current = current.parentNode) {
      const key = Object.keys(current).find((name) => name.startsWith('__reactFiber$'));
      if (key) return current[key];
    }
    return null;
  };
  const touchedBy = (records) => {
    const touched = new Set();
    const mark = (node) => {
      for (let fiber = fiberOf(node); fiber && !touched.has(fiber); fiber = fiber.return) {
        touched.add(fiber);
        if (fiber.alternate) touched.add(fiber.alternate);
      }
    };
    // An attribute or a text written with the value it had is no change: React sets an input's
    // `name` and `type` again whenever the input renders. Each is compared with what it was
    // before the first write since the last commit.
    const before = new Map();
    for (const record of records) {
      if (record.type === 'childList') {
        mark(record.target);
        for (const node of record.addedNodes) mark(node);
        continue;
      }
      let written = before.get(record.target);
      if (!written) before.set(record.target, (written = new Map()));
      const key = record.type === 'attributes' ? `@${record.attributeName}` : '#text';
      if (!written.has(key)) written.set(key, record.oldValue);
    }
    for (const [node, written] of before) {
      for (const [key, value] of written) {
        const now = key === '#text' ? node.data : node.getAttribute(key.slice(1));
        if (now !== value) mark(node);
      }
    }

    for (const control of document.querySelectorAll('input, textarea, select, option')) {
      const values = [control.localName === 'option' ? control.selected : control.value];

      if (control.localName === 'input') values.push(control.checked);

      if (control.localName === 'select') values.push(control.selectedIndex);
      const previous = controls.get(control);

      if (previous && values.some((value, index) => value !== previous[index])) mark(control);
      controls.set(control, values);
    }
    return touched;
  };

  // Every execution of one of the framework's own components, committed or not.
  const executions = (window.__executions = []);
  window.__executed = (fn, path) => executions.push({ fn, path, phase: window.__phase });
  const calls = (window.__calls = []);
  window.__renderCall = (path) => {
    const call = { at: performance.now(), kept: false, path, phase: window.__phase };
    calls.push(call);
    return call;
  };
  window.__kept = (call) => {
    if (call) call.kept = true;
  };
  // The framework component a fiber is inside of: the nearest view above it.
  const isView = (type) => typeof type === 'function' && type.name === 'View' && Boolean(type.displayName);
  const withinOf = (fiber) => {
    for (let node = fiber.return; node; node = node.return) if (isView(node.type)) return node.type.displayName;
    return '';
  };
  window.__suspend = (path, on) => calls.push({ at: performance.now(), path, phase: window.__phase, suspend: on });
  const commits = (window.__renders = []);
  window.__phase = 'load';
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    checkDCE() {},
    inject(renderer) {
      const id = this.renderers.size + 1;
      this.renderers.set(id, renderer);
      return id;
    },
    isDisabled: false,
    onCommitFiberRoot(_, root) {
      const touched = touchedBy(observer.takeRecords());
      const commit = { at: performance.now(), components: [], phase: window.__phase };
      const walk = (parent) => {
        if (parent.alternate && parent.child === parent.alternate.child) return;
        for (let node = parent.child; node; node = node.sibling) {
          if (
            COMPONENT_TAGS.has(node.tag) &&
            (node.alternate === null || (node.flags & PERFORMED_WORK) === PERFORMED_WORK)
          ) {
            const reworked = !(node.alternate && node.child === node.alternate.child);
            let children = 0;
            if (reworked)
              for (let child = node.child; child; child = child.sibling) children += child.actualDuration || 0;
            commit.components.push({
              // A removal shows in the mutations only at the parent node, outside a component that
              // removes all it rendered (one that now renders nothing), so React's flags say it.
              dom: touched.has(node) || ((node.flags | node.subtreeFlags) & CHILD_DELETION) !== 0,
              fn: typeof node.type === 'function' ? node.type.name : '',
              mounted: node.alternate === null,
              name: nameOf(node),
              self: Math.max(0, (node.actualDuration || 0) - children),
              // The function that rendered it directly: a library's component is told by who composes it.
              under: typeof node.return?.type === 'function' ? node.return.type.name : '',
              why: node.alternate ? why(node) : undefined,
              within: withinOf(node),
            });
          }
          walk(node);
        }
      };
      walk(root.current);
      commits.push(commit);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    renderers: new Map(),
    setStrictMode() {},
    supportsFiber: true,
  };
})();
