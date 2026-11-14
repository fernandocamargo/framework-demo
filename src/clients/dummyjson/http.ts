// The transport to DummyJSON, with what a client owes the app on a bad network:
// - the access token on requests that need one, and one refresh shared by every request that
//   meets a 401 at the same time;
// - retries with backoff for 5xx, 429 and failed connections, where repeating is safe;
// - the caller's AbortSignal, honoured while waiting as well as while fetching;
// - the network lab's faults, which use DummyJSON's own `delay` and `/http/<status>` helpers,
//   so a forced failure is a real response.
// The wire is a parameter: `fetch` for the real thing, a function for the memory world.

import { type KeyValue, sleep } from '../storage';

export type Wire = (url: string, init: RequestInit) => Promise<Response>;

export type User = { firstName: string; id: number; image: string; lastName: string; username: string };
export type Session = { expiresAt: number; user: User };
export type Credentials = { password: string; username: string };

/** The network lab's settings. */
export type Settings = {
  /** The share of requests, 0 to 1, that fail with a 500. */
  failureRate: number;
  /** Every request answers with this status; 0 for none. */
  force: 0 | 429 | 500;
  /** Milliseconds DummyJSON waits before it answers (its `delay` parameter). */
  latency: number;
  /** No request leaves the browser. */
  offline: boolean;
  /** How long a new access token lives, in minutes. */
  tokenMinutes: number;
};

export type Entry = {
  at: number;
  id: number;
  kind: 'failed' | 'fault' | 'refresh' | 'request' | 'retry';
  text: string;
};

export type RequestOptions = {
  /** Send the access token, and refresh it once on a 401. */
  auth?: boolean;
  query?: Record<string, number | string | undefined>;
  signal?: AbortSignal;
};

export class HttpError extends Error {
  override name = 'HttpError';
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export class OfflineError extends Error {
  override name = 'OfflineError';
  constructor() {
    super('The network is unreachable.');
  }
}

export class SessionError extends Error {
  override name = 'SessionError';
}

const RETRIES = 2;
const KEY = 'framework-demo:session';
const SAFE = new Set(['GET', 'PUT', 'DELETE']);

type Stored = { accessToken: string; expiresAt: number; refreshToken: string; user: User };
type Tokens = { accessToken: string; refreshToken: string };

export type Options = {
  /** The first retry's wait, in milliseconds; each next one doubles it. */
  backoff?: number;
  baseUrl: string;
  now?: () => number;
  random?: () => number;
  storage: KeyValue;
  wire: Wire;
};

export type Http = ReturnType<typeof createHttp>;

export function createHttp({ backoff = 400, baseUrl, now = Date.now, random = Math.random, storage, wire }: Options) {
  const settings: Settings = { failureRate: 0, force: 0, latency: 0, offline: false, tokenMinutes: 1 };
  let entries: Entry[] = [];
  let entryId = 0;
  const log = (kind: Entry['kind'], text: string) => {
    entries = [{ at: now(), id: entryId++, kind, text }, ...entries].slice(0, 40);
  };

  // ---- The session ---------------------------------------------------------------------------

  const stored = (): null | Stored => {
    try {
      return JSON.parse(storage.getItem(KEY) ?? 'null') as null | Stored;
    } catch {
      return null;
    }
  };
  const keep = (session: null | Stored) =>
    session ? storage.setItem(KEY, JSON.stringify(session)) : storage.removeItem(KEY);
  const lifetime = () => ({ expiresAt: now() + settings.tokenMinutes * 60_000, expiresInMins: settings.tokenMinutes });
  const shown = (session: Stored): Session => ({ expiresAt: session.expiresAt, user: session.user });

  /**
   * One refresh at a time: every request that meets a 401 while it runs waits for the same one.
   * Across tabs too, since they share the session: the refresh runs under a Web Lock, and a tab
   * that gets the lock after another refreshed finds the new tokens in the storage and uses them,
   * instead of spending the refresh token again (a server that rotates them would refuse it).
   */
  let refreshing: Promise<Session> | undefined;
  const exclusively = <T>(work: () => Promise<T>): Promise<T> =>
    typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(`${KEY}:refresh`, work) : work();
  const refresh = (refused?: string) =>
    (refreshing ??= exclusively(async () => {
      const session = stored();
      if (!session) throw new SessionError('Sign in to continue.');
      if (refused !== undefined && session.accessToken !== refused) {
        log('refresh', 'Another tab refreshed the access token: using it');
        return shown(session);
      }
      const { expiresAt, expiresInMins } = lifetime();
      try {
        const tokens = await request<Tokens>('POST', '/auth/refresh', {
          body: { expiresInMins, refreshToken: session.refreshToken },
          safe: true,
        });
        const next = { ...session, ...tokens, expiresAt };
        keep(next);
        log('refresh', `New access token, good for ${expiresInMins} min`);
        return shown(next);
      } catch (error) {
        // A refusal ends the session. Anything else (offline, a 500) leaves it, to try again.
        if (error instanceof HttpError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          keep(null);
          log('failed', 'The refresh token was refused: the session is over');
          throw new SessionError('Your session has expired. Sign in again.');
        }
        throw error;
      }
    }).finally(() => {
      refreshing = undefined;
    }));

  // ---- One request, with its faults ----------------------------------------------------------

  type Internal = RequestOptions & { body?: unknown; safe?: boolean };

  async function send(method: string, path: string, { auth, body, query, signal }: Internal): Promise<Response> {
    if (settings.offline) {
      log('fault', `${method} ${path}: offline`);
      throw new OfflineError();
    }
    const forced = settings.force || (random() < settings.failureRate ? 500 : 0);
    const url = new URL(baseUrl + (forced ? `/http/${forced}` : path));
    if (!forced)
      for (const [key, value] of Object.entries(query ?? {}))
        if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    if (settings.latency) url.searchParams.set('delay', String(settings.latency));
    if (forced) log('fault', `${method} ${path}: answered by /http/${forced}`);
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth) {
      const session = stored();
      if (!session) throw new SessionError('Sign in to continue.');
      headers['authorization'] = `Bearer ${session.accessToken}`;
    }
    return wire(url.toString(), {
      headers,
      method: forced ? 'GET' : method,
      ...(body !== undefined && !forced ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  }

  const failure = async (response: Response) => {
    const body = (await response.json().catch(() => null)) as null | { message?: string };
    const retryAfter = Number(response.headers.get('retry-after'));
    return new HttpError(
      response.status,
      body?.message ?? `The server answered ${response.status}.`,
      retryAfter > 0 ? retryAfter * 1000 : undefined,
    );
  };

  const isAbort = (error: unknown, signal?: AbortSignal) =>
    Boolean(signal?.aborted) || (error instanceof DOMException && error.name === 'AbortError');

  /** Whether the same request may go again: the server was busy or unreachable, and repeating does no harm. */
  const mayRetry = (error: unknown, method: string, safe?: boolean) => {
    if (error instanceof OfflineError || error instanceof SessionError) return false;
    if (error instanceof HttpError) return error.status === 429 || (error.status >= 500 && (safe || SAFE.has(method)));
    // `fetch` rejects with a TypeError when the connection fails.
    return safe || SAFE.has(method);
  };

  async function request<T>(method: string, path: string, options: Internal = {}): Promise<T> {
    let refreshed = false;
    for (let attempt = 0; ; attempt += 1) {
      options.signal?.throwIfAborted();
      let error: unknown;
      // The access token this attempt sends: a refresh after a 401 knows which one was refused.
      const sentToken = options.auth ? stored()?.accessToken : undefined;
      try {
        const response = await send(method, path, options);
        if (response.ok) {
          log('request', `${method} ${path} → ${response.status}`);
          return (await response.json()) as T;
        }
        error = await failure(response);
      } catch (thrown) {
        if (isAbort(thrown, options.signal)) throw thrown;
        error = thrown;
      }
      // An expired access token: refresh it, once, and send the request again.
      if (options.auth && !refreshed && error instanceof HttpError && error.status === 401) {
        refreshed = true;
        attempt -= 1;
        log('refresh', `${method} ${path} → 401: refreshing the access token`);
        await refresh(sentToken);
        continue;
      }
      if (attempt >= RETRIES || !mayRetry(error, method, options.safe)) {
        log('failed', `${method} ${path}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
      const wait = (error instanceof HttpError && error.retryAfter) || backoff * 2 ** attempt * (0.5 + random() / 2);
      log(
        'retry',
        `${method} ${path}: ${error instanceof HttpError ? error.status : 'no connection'}, retry ${attempt + 1} of ${RETRIES} in ${Math.round(wait)} ms`,
      );
      await sleep(wait, options.signal);
    }
  }

  return {
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    /** What the network lab reads and changes. */
    lab: {
      activity: (): Entry[] => entries,
      /** Makes the refresh token one the server refuses: the next refresh ends the session. */
      breakRefresh() {
        const session = stored();
        if (session) keep({ ...session, refreshToken: `${session.refreshToken}.revoked` });
      },
      change: (changes: Partial<Settings>): Settings => Object.assign(settings, changes) && { ...settings },
      /** Makes the access token one the server refuses, as an expired one is: the next request that needs it refreshes. */
      expireToken() {
        const session = stored();
        if (session) keep({ ...session, accessToken: `${session.accessToken}.expired` });
      },
      settings: (): Settings => ({ ...settings }),
    },
    post: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),

    put: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),

    session: {
      /** Calls `listener` when another tab signs in, renews the session or signs out; returns what stops it. */
      changed: (listener: () => void) => storage.watch?.(KEY, listener) ?? (() => undefined),
      current: (): null | Session => {
        const session = stored();
        return session && shown(session);
      },
      refresh: () => refresh(),
      async signIn(credentials: Credentials): Promise<Session> {
        const { expiresAt, expiresInMins } = lifetime();
        const { accessToken, refreshToken, ...user } = await request<Tokens & User>('POST', '/auth/login', {
          body: { ...credentials, expiresInMins },
        });
        const session = {
          accessToken,
          expiresAt,
          refreshToken,
          user: {
            firstName: user.firstName,
            id: user.id,
            image: user.image,
            lastName: user.lastName,
            username: user.username,
          },
        };
        keep(session);
        return shown(session);
      },
      signOut: () => keep(null),
    },
  };
}
