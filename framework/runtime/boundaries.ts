/**
 * A folder's boundaries, placed around its element by whoever renders it.
 *
 * A folder is one component: it waits for its view, calls every hook and calls the render. A
 * component's own `Suspense` cannot catch what its own hooks wait for, and its own error boundary
 * cannot catch what it throws, so neither is in the folder's component. They are composed around
 * its element where the element is written: the plugin rewrites every file that writes one as a
 * JSX tag (`<Child … />` becomes `bound(<Child … />)`), a folder's own files and the app's shell
 * alike, and `Root` does it for the elements it is given directly. Any other code that renders a
 * folder (a story, a frame of the states gallery, a test) calls `bound` itself; without it, the
 * nearest boundaries above catch the folder, its placeholder and error files are not shown, and
 * the dev runtime says so (`useBound`).
 *
 * A folder with an `error.tsx` gets an error boundary (react-error-boundary's, below), and one
 * with a `placeholder.tsx` a `Suspense` inside it. A folder with neither gets nothing: its element is returned as it is.
 * What is composed holds only the folder and the props its element was given, so two
 * compositions of equal elements are equal (elements.ts), and React skips them.
 */

import {
  Children,
  type ComponentClass,
  type ComponentType,
  createContext,
  createElement,
  type ErrorInfo,
  isValidElement,
  type ReactElement,
  type ReactNode,
  Suspense,
  use,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { ErrorBoundary, type ErrorBoundaryProps } from 'react-error-boundary';

import { HOT } from './hot';
import { report, type Scope } from './pipeline';
import { chainOf } from './track';

type Props = Record<string, unknown>;

/** The instance a component renders in: the folder's path, and the instance above it. */
export const ScopeContext = createContext<null | Scope>(null);
ScopeContext.displayName = 'Scope';

/**
 * A folder's files as the dev server last sent them: who listens for the next ones, how many came,
 * and how many of them changed the hooks the folder's component calls.
 */
export type Edits = { hooks: number; listeners: Set<() => void>; version: number };

/**
 * Under the dev server: the folder whose element was composed around here, and how many times its
 * files were sent. The folder's component reads it, so it renders with the new files when its
 * props are the same, and can tell when its element was not composed (`useBound`).
 */
const EditedContext = createContext<null | { edits: Edits; version: number }>(null);
EditedContext.displayName = 'Edited';

/** The folders already said to be rendered without their boundaries, each said once. */
const unbound = new Set<string>();

/**
 * Under the dev server, for a folder's component: follows the folder's edits, and says so when its
 * element was not composed with `bound` (nothing above it follows this folder's edits). That is a
 * folder written where the plugin's rewrite does not reach: held in a variable, passed as a prop,
 * made with `createElement`, or rendered by code outside a folder's files.
 */
export function useBound(edits: Edits, path: string) {
  if (use(EditedContext)?.edits === edits || unbound.has(path)) return;
  unbound.add(path);
  console.warn(
    `[framework] ${path} is rendered without its boundaries: its placeholder.tsx and error.tsx will not show, a failure in it is reported for the folder above, and edits under the dev server will not reach it. Write it as a JSX tag in a render, placeholder or error file, or compose it yourself: bound(<Component … />), from 'framework'.`,
  );
}

/** Renders again when the folder's files are sent again. */
const useEdits = (edits: Edits) => {
  const subscribe = useCallback(
    (listener: () => void) => {
      edits.listeners.add(listener);

      return () => edits.listeners.delete(listener);
    },
    [edits],
  );

  return useSyncExternalStore(subscribe, () => edits.version);
};

/** What a folder's component carries for whoever renders it. */
export type Around = {
  /** Under the dev server: the folder's edits. */
  edits?: Edits;
  /** The folder's error file while it shows, for a folder with one. It gets what the folder was given. */
  Failed?: ComponentType<Props>;
  path: string;
  /** The folder's placeholder while it shows, for a folder with one. It gets what the folder was given. */
  Waiting?: ComponentType<Props>;
};
type Folder = ComponentType<Props> & { around: Around };

/** What the framework gives the library's boundary beside the library's own props. */
type Own = { folder: Folder; given: Props };

/**
 * A folder's error boundary: react-error-boundary's, which keeps what was caught, shows the
 * fallback, and resets ("Try again" reaches it through its `useErrorBoundary()`).
 *
 * It is a subclass, where React's documentation prefers composition, for one reason. A failure is
 * reported with the chain of instances above it, which is in `ScopeContext`. The library reports
 * through `onError`, a prop: whoever composes the boundary would have to read the context to make
 * it, and `bound` is a plain function called in a parent's render, with no context of its own. A
 * component above the boundary that reads the context and passes `onError` is the wrapper this
 * file exists to avoid, and a new function at every render besides. The one place that has both
 * the catch and the context is the class: `contextType`, and `componentDidCatch`, which then
 * calls the library's. Nothing else of the library is changed, and nothing of it is used but what
 * its types publish: the class, its `fallback` prop and `componentDidCatch`.
 */
class Reporting extends ErrorBoundary {
  static override contextType = ScopeContext;
  declare context: null | Scope;
  declare props: Readonly<ErrorBoundaryProps & Own>;
  override componentDidCatch(error: unknown, info: ErrorInfo) {
    const { path } = this.props.folder.around;
    report(error, { chain: [...chainOf(this.context), path], layer: 'render', path });
    super.componentDidCatch(error, info);
  }
  /**
   * As `memo` does for the folder's component: the same folder given the same props shows the
   * same. Everything else the boundary is given (its fallback, its children) follows from those.
   */
  override shouldComponentUpdate(next: Readonly<ErrorBoundaryProps & Own>, state: unknown) {
    return state !== this.state || next.folder !== this.props.folder || !sameProps(next.given, this.props.given);
  }
}
/** The boundary as `bound` composes it: the library's props, and the framework's. */
const Boundary = Reporting as unknown as ComponentClass<ErrorBoundaryProps & Own>;

/**
 * Under the dev server only: follows the folder's edits for its element. Each edit renders the
 * folder's component with the new files, and the element's key says which hooks the component
 * calls, so an edit that changes them mounts it again. Production builds have none of this.
 */
function Edited({ edits, folder, given }: { edits: Edits; folder: Folder; given: Props }) {
  const version = useEdits(edits);
  const edited = useMemo(() => ({ edits, version }), [edits, version]);
  return createElement(EditedContext, { value: edited }, createElement(folder, { ...given, key: edits.hooks }));
}

/** The props are the same when they have the same keys with the same values, as `memo` compares them. */
export const sameProps = (a: Props, b: Props) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
  );
};

const isFolder = (type: unknown): type is Folder =>
  typeof type === 'object' && type !== null && typeof (type as Partial<Folder>).around === 'object';

/** A folder's element with the folder's boundaries around it. Anything else is returned as it is. */
export function bound<T>(element: T): ReactElement | T {
  if (!isValidElement<Props>(element) || !isFolder(element.type)) return element;
  const folder = element.type;
  const given = element.props;
  const { key } = element;
  const { edits, Failed, Waiting } = folder.around;
  // The element's key goes on whatever is outermost: that is what its siblings are told apart by.
  const keyed = key === null ? {} : { key };
  let tree: ReactElement = element;
  if (HOT && edits) tree = createElement(Edited, { edits, folder, given, ...keyed });
  if (Waiting) tree = createElement(Suspense, { fallback: createElement(Waiting, given), ...keyed }, tree);
  if (Failed) tree = createElement(Boundary, { fallback: createElement(Failed, given), folder, given, ...keyed }, tree);
  return tree;
}

/** What `Root` is given, each folder among it with its boundaries. */
export const boundEach = (children: ReactNode): ReactNode => Children.map(children, bound);
