/**
 * The pipelines: one `EventTarget` that carries three kinds of event.
 *
 * - `interaction`: every `on…` handler a render passes, tracked by default with its placement,
 *   and every key a `shortcuts.ts` declares. The framework's plugin wraps each one; nobody writes
 *   tracking code.
 * - `failure`: every layer's failures, tagged with where they happened: the component or
 *   service path, the layer, and what was running. Reported once, where first caught.
 * - `data`: what the data layer does: each read the server answers, each write and how it ended,
 *   the reads a write made stale, each optimistic change and each one taken back, each component
 *   answer worked out again from the cache, and each message to or from the other tabs. A write
 *   started by a handler names the interaction (`cause`).
 *
 * Listeners plug in with `connect` (destinations such as analytics tools, held until consent)
 * or `addEventListener('failure', …)` (an error tracker). Dispatch waits for a microtask, so
 * no listener ever runs inside a React render.
 */

/** Where a handler was attached, known when the app is built. */
export type Site = {
  column: number;
  /** The element or component as written: `button`, `Row`. */
  element: string;
  file: string;
  /** The handler as written, cut to 80 characters. */
  handler: string;
  /** Stable within a build: `components/catalogue#Button.onPress@14:9`. */
  id: string;
  line: number;
  /** The component's folder path. */
  path: string;
  /** `onClick`, `onSelect`. */
  prop: string;
};

/** Which component instance is rendering, and its ancestors. Known while the app runs. */
export type Scope = { parent: null | Scope; path: string };

export type Interaction = {
  at: number;
  /** The interaction whose handler called this one: a click on a row causes the list's `onSelect`. */
  cause?: number;
  /** Ancestor component paths, outermost first. */
  chain: string[];
  id: number;
  /** The element's list key, if it has one. */
  key?: unknown;
  kind: 'interaction';
  /** `${path}#${element}.${prop}`. */
  name: string;
  /** Where the app was when it happened (`currentRoute`). */
  route: string;
  site: Site;
  /** The DOM event's type, when the handler got one. Never its target, text or values (PII). */
  type?: string;
};

/** The layer a failure happened in. */
export type Layer = 'acl' | 'async' | 'global' | 'handler' | 'props' | 'render' | 'service' | 'shortcuts' | 'state';

export type Failure = {
  at: number;
  /** Ancestor component paths, outermost first, when known. */
  chain?: string[];
  /** What was running: an async operation's name, a state, a handler's site. */
  during?: string;
  error: Error;
  id: number;
  kind: 'failure';
  layer: Layer;
  /** The component's folder path, or the service's path (`products.save`). */
  path?: string;
  /** Where the app was when it happened (`currentRoute`). */
  route: string;
  /** For a failed handler: where it was attached. */
  site?: Site;
};

/** What the data layer did. */
export type DataEvent = {
  /**
   * - `read`: the server answered a read (`path` is the operation's), or a component's default read
   *   ran (`path` is the component's, `reads` what it called);
   * - `derive`: a component's answer was worked out again from the cache, for an optimistic write;
   * - `write`: a write was sent, or ended (`outcome`);
   * - `optimistic`: a write's changes to `reads` show; `rollback`: they were taken back;
   * - `stale`: `reads` were made stale, by the write at `path`, by another tab's (`outcome:
   *   'received'`), or by their own source (`'pushed'`: a read that follows it, in `meta.ts`);
   * - `tab`: a message to the other tabs (`outcome: 'sent'`) or from one (`'received'`).
   */
  action: 'derive' | 'optimistic' | 'read' | 'rollback' | 'stale' | 'tab' | 'write';
  at: number;
  /** The interaction whose handler started it. */
  cause?: number;
  id: number;
  kind: 'data';
  /** How long it took, in milliseconds. */
  ms?: number;
  outcome?: 'done' | 'failed' | 'pushed' | 'received' | 'sent';
  path: string;
  reads?: string[];
  route: string;
};

type Event = DataEvent | Failure | Interaction;
type Processor = (event: Event) => Event | null;

/**
 * Where the app is, for the events. A router that keeps the route out of the address, as a
 * memory router does inside an iframe, tells it through `Root`'s `location`, which
 * sets it here. Without one, the address's hash, where a hash router keeps the route.
 */
let told: string | undefined;
export const setLocation = (location: string) => {
  told = location;
  return () => {
    if (told === location) told = undefined;
  };
};
export const currentRoute = () => told ?? (window.location.hash || '#/');

let next = 1;
export const nextId = () => next++;

class Pipeline extends EventTarget {
  #processors: Processor[] = [];
  #queue: Event[] = [];

  emit(event: Event) {
    if (this.#queue.push(event) === 1) queueMicrotask(() => this.#drain());
  }

  /** Runs before every listener, in order: enrichment, PII redaction, sampling. `null` drops the event. */
  process(processor: Processor) {
    this.#processors.push(processor);
    return () => {
      this.#processors = this.#processors.filter((other) => other !== processor);
    };
  }

  #drain() {
    for (const event of this.#queue.splice(0)) {
      let out: Event | null = event;
      for (const processor of this.#processors) if ((out = processor(out)) === null) break;
      // Each listener runs on its own: one that throws does not stop the others.
      if (out) this.dispatchEvent(new CustomEvent(out.kind, { detail: out }));
    }
  }
}

export const pipeline = new Pipeline();

const reported = new WeakSet<object>();

/** A thrown value as an `Error`, whatever was thrown. */
export const toError = (thrown: unknown) =>
  thrown instanceof Error ? thrown : new Error(String(thrown), { cause: thrown });

/**
 * Reports a failure once: the first layer that catches an error tags it (the innermost, usually
 * the service), and later layers that see the same error stay quiet.
 */
export function report(
  thrown: unknown,
  tags: { chain?: string[]; during?: string; layer: Layer; path?: string; site?: Site },
) {
  const error = toError(thrown);
  if (reported.has(error)) return error;
  reported.add(error);
  if (thrown !== error && typeof thrown === 'object' && thrown) reported.add(thrown);
  pipeline.emit({ error, id: nextId(), kind: 'failure', ...tags, at: performance.now(), route: currentRoute() });
  return error;
}

/** Consent, by purpose. A destination's events wait until its purpose is granted. */
class Consent extends EventTarget {
  #granted = new Set<string>();
  grant(purpose: string) {
    this.#granted.add(purpose);
    this.dispatchEvent(new CustomEvent('change', { detail: purpose }));
  }
  has(purpose: string) {
    return this.#granted.has(purpose);
  }
}

export const consent = new Consent();

export type Destination<Payload> = {
  accept?: (interaction: Interaction) => boolean;
  batch?: { ms: number; size: number };
  map: (interaction: Interaction) => null | Payload;
  name: string;
  /** The consent purpose, such as `analytics`. */
  purpose: string;
  send: (batch: Payload[]) => void;
};

/** Plugs a destination into the interactions. Returns the function that unplugs it. */
export function connect<Payload>(destination: Destination<Payload>) {
  const queue: Payload[] = [];
  const held: Payload[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (queue.length) destination.send(queue.splice(0));
  };
  const enqueue = (payload: Payload) => {
    queue.push(payload);
    const { ms = 0, size = 1 } = destination.batch ?? {};
    if (queue.length >= size) flush();
    else timer ??= setTimeout(flush, ms);
  };
  const onInteraction = (event: globalThis.Event) => {
    const interaction = (event as CustomEvent<Interaction>).detail;
    if (destination.accept && !destination.accept(interaction)) return;
    const payload = destination.map(interaction);
    if (payload === null) return;
    if (consent.has(destination.purpose)) enqueue(payload);
    else held.push(payload);
  };
  const onConsent = () => {
    if (consent.has(destination.purpose)) held.splice(0).forEach(enqueue);
  };
  const onHidden = () => document.visibilityState === 'hidden' && flush();
  pipeline.addEventListener('interaction', onInteraction);
  consent.addEventListener('change', onConsent);
  document.addEventListener('visibilitychange', onHidden);
  return () => {
    flush();
    pipeline.removeEventListener('interaction', onInteraction);
    consent.removeEventListener('change', onConsent);
    document.removeEventListener('visibilitychange', onHidden);
  };
}

/** Listens to every failure. Returns the function that stops listening. */
export function onFailure(listener: (failure: Failure) => void) {
  const handle = (event: globalThis.Event) => listener((event as CustomEvent<Failure>).detail);
  pipeline.addEventListener('failure', handle);
  return () => pipeline.removeEventListener('failure', handle);
}

/** Listens to what the data layer does. Returns the function that stops listening. */
export function onData(listener: (event: DataEvent) => void) {
  const handle = (event: globalThis.Event) => listener((event as CustomEvent<DataEvent>).detail);
  pipeline.addEventListener('data', handle);
  return () => pipeline.removeEventListener('data', handle);
}

/** Emits what the data layer did, stamped. */
export const emitData = (event: Omit<DataEvent, 'at' | 'id' | 'kind' | 'route'>) =>
  pipeline.emit({ id: nextId(), kind: 'data', ...event, at: performance.now(), route: currentRoute() });
