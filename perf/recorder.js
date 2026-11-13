// A stand-in for React DevTools' global hook, run before the app's scripts (perf/cycles.mjs).
// On every commit it records each component React rendered, with:
// - `mounted`, or why it re-rendered: its own state or a context (`own`), its parent with the
//   same props (`parent`), or the props that changed, each marked `sameValue` when only the
//   reference is new (a function with the same code, an object or element with equal contents);
// - `dom`: whether the commit changed the page anywhere inside it (an attribute, a text, a node
//   added or removed). A re-render with `dom: false` changed nothing anyone can see.
// It also counts every call of a framework component's render, committed or not
// (`window.__renderCall`, from perf/vite.config.ts), per step (`window.__phase`).
(() => {
  const PERFORMED_WORK = 1;
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
    if (a.$$typeof && a.$$typeof === b.$$typeof) return a.type === b.type && a.key === b.key && equal(a.props, b.props, depth + 1);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => key !== '_owner' && equal(a[key], b[key], depth + 1));
  };
  const kindOf = (value) =>
    typeof value === 'function' ? 'function' : value && value.$$typeof ? 'element' : Array.isArray(value) ? 'array' : typeof value;
  const why = (fiber) => {
    const previous = fiber.alternate.memoizedProps;
    const next = fiber.memoizedProps;
    if (previous === next) return { cause: 'own' };
    const changed = [];
    for (const key of new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])) {
      if (Object.is(previous[key], next[key])) continue;
      changed.push({ key, kind: kindOf(next[key]), sameValue: equal(previous[key], next[key]) });
    }
    return { cause: changed.length ? 'props' : 'parent', changed };
  };

  // What changed in the page since the last commit, as the fibers it touched and their ancestors.
  const observer = new MutationObserver(() => {});
  // The document itself: as an init script, this runs before the page has an <html> element.
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
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
    for (const record of records) {
      mark(record.target);
      for (const node of record.addedNodes || []) mark(node);
    }
    return touched;
  };

  const calls = (window.__calls = []);
  window.__renderCall = (path) => calls.push({ phase: window.__phase, path, at: performance.now() });
  window.__suspend = (path, on) => calls.push({ phase: window.__phase, path, at: performance.now(), suspend: on });
  const commits = (window.__renders = []);
  window.__phase = 'load';
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    checkDCE() {},
    inject(renderer) {
      const id = this.renderers.size + 1;
      this.renderers.set(id, renderer);
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
    onCommitFiberRoot(_, root) {
      const touched = touchedBy(observer.takeRecords());
      const commit = { phase: window.__phase, at: performance.now(), components: [] };
      const walk = (parent) => {
        if (parent.alternate && parent.child === parent.alternate.child) return;
        for (let node = parent.child; node; node = node.sibling) {
          if (COMPONENT_TAGS.has(node.tag) && (node.alternate === null || (node.flags & PERFORMED_WORK) === PERFORMED_WORK)) {
            const reworked = !(node.alternate && node.child === node.alternate.child);
            let children = 0;
            if (reworked) for (let child = node.child; child; child = child.sibling) children += child.actualDuration || 0;
            commit.components.push({
              name: nameOf(node),
              fn: typeof node.type === 'function' ? node.type.name : '',
              mounted: node.alternate === null,
              self: Math.max(0, (node.actualDuration || 0) - children),
              dom: touched.has(node),
              why: node.alternate ? why(node) : undefined,
            });
          }
          walk(node);
        }
      };
      walk(root.current);
      commits.push(commit);
    },
  };
})();
