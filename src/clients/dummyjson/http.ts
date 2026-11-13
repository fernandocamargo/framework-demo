// The transport to DummyJSON, with what a client owes the app on a bad network:
// - the access token on requests that need one, and one refresh shared by every request that
//   meets a 401 at the same time;
// - retries with backoff for 5xx, 429 and failed connections, where repeating is safe;
// - the caller's AbortSignal, honoured while waiting as well as while fetching;
// - the network lab's faults, which use DummyJSON's own `delay` and `/http/<status>` helpers,
//   so a forced failure is a real response.
// The wire is a parameter: `fetch` for the real thing, a function for the memory world.
import { sleep, type KeyValue } from '../storage'

export type Wire = (url: string, init: RequestInit) => Promise<Response>

export type User = { id: number; username: string; firstName: string; lastName: string; image: string }
export type Session = { user: User; expiresAt: number }
export type Credentials = { username: string; password: string }

/** The network lab's settings. */
export type Settings = {
  /** Milliseconds DummyJSON waits before it answers (its `delay` parameter). */
  latency: number
  /** The share of requests, 0 to 1, that fail with a 500. */
  failureRate: number
  /** Every request answers with this status; 0 for none. */
  force: 0 | 429 | 500
  /** No request leaves the browser. */
  offline: boolean
  /** How long a new access token lives, in minutes. */
  tokenMinutes: number
}

export type Entry = { id: number; at: number; kind: 'request' | 'retry' | 'refresh' | 'fault' | 'failed'; text: string }

export type RequestOptions = {
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
  /** Send the access token, and refresh it once on a 401. */
  auth?: boolean
}

export class HttpError extends Error {
  override name = 'HttpError'
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message)
  }
}

export class OfflineError extends Error {
  override name = 'OfflineError'
  constructor() {
    super('The network is unreachable.')
  }
}

export class SessionError extends Error {
  override name = 'SessionError'
}

const RETRIES = 2
const KEY = 'framework-demo:session'
const SAFE = new Set(['GET', 'PUT', 'DELETE'])

type Stored = { user: User; accessToken: string; refreshToken: string; expiresAt: number }
type Tokens = { accessToken: string; refreshToken: string }

export type Options = {
  baseUrl: string
  wire: Wire
  storage: KeyValue
  /** The first retry's wait, in milliseconds; each next one doubles it. */
  backoff?: number
  random?: () => number
  now?: () => number
}

export type Http = ReturnType<typeof createHttp>

export function createHttp({ baseUrl, wire, storage, backoff = 400, random = Math.random, now = Date.now }: Options) {
  const settings: Settings = { latency: 0, failureRate: 0, force: 0, offline: false, tokenMinutes: 1 }
  let entries: Entry[] = []
  let entryId = 0
  const log = (kind: Entry['kind'], text: string) => {
    entries = [{ id: entryId++, at: now(), kind, text }, ...entries].slice(0, 40)
  }

  // ---- The session ---------------------------------------------------------------------------

  const stored = (): Stored | null => {
    try {
      return JSON.parse(storage.getItem(KEY) ?? 'null') as Stored | null
    } catch {
      return null
    }
  }
  const keep = (session: Stored | null) => (session ? storage.setItem(KEY, JSON.stringify(session)) : storage.removeItem(KEY))
  const lifetime = () => ({ expiresInMins: settings.tokenMinutes, expiresAt: now() + settings.tokenMinutes * 60_000 })
  const shown = (session: Stored): Session => ({ user: session.user, expiresAt: session.expiresAt })

  /** One refresh at a time: every request that meets a 401 while it runs waits for the same one. */
  let refreshing: Promise<Session> | undefined
  const refresh = () =>
    (refreshing ??= (async () => {
      const session = stored()
      if (!session) throw new SessionError('Sign in to continue.')
      const { expiresInMins, expiresAt } = lifetime()
      try {
        const tokens = await request<Tokens>('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken, expiresInMins }, safe: true })
        const next = { ...session, ...tokens, expiresAt }
        keep(next)
        log('refresh', `New access token, good for ${expiresInMins} min`)
        return shown(next)
      } catch (error) {
        // A refusal ends the session. Anything else (offline, a 500) leaves it, to try again.
        if (error instanceof HttpError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          keep(null)
          log('failed', 'The refresh token was refused: the session is over')
          throw new SessionError('Your session has expired. Sign in again.')
        }
        throw error
      }
    })().finally(() => {
      refreshing = undefined
    }))

  // ---- One request, with its faults ----------------------------------------------------------

  type Internal = RequestOptions & { body?: unknown; safe?: boolean }

  async function send(method: string, path: string, { query, body, signal, auth }: Internal): Promise<Response> {
    if (settings.offline) {
      log('fault', `${method} ${path}: offline`)
      throw new OfflineError()
    }
    const forced = settings.force || (random() < settings.failureRate ? 500 : 0)
    const url = new URL(baseUrl + (forced ? `/http/${forced}` : path))
    if (!forced) for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    if (settings.latency) url.searchParams.set('delay', String(settings.latency))
    if (forced) log('fault', `${method} ${path}: answered by /http/${forced}`)
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (auth) {
      const session = stored()
      if (!session) throw new SessionError('Sign in to continue.')
      headers['authorization'] = `Bearer ${session.accessToken}`
    }
    return wire(url.toString(), {
      method: forced ? 'GET' : method,
      headers,
      ...(body !== undefined && !forced ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    })
  }

  const failure = async (response: Response) => {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    const retryAfter = Number(response.headers.get('retry-after'))
    return new HttpError(response.status, body?.message ?? `The server answered ${response.status}.`, retryAfter > 0 ? retryAfter * 1000 : undefined)
  }

  const isAbort = (error: unknown, signal?: AbortSignal) => Boolean(signal?.aborted) || (error instanceof DOMException && error.name === 'AbortError')

  /** Whether the same request may go again: the server was busy or unreachable, and repeating does no harm. */
  const mayRetry = (error: unknown, method: string, safe?: boolean) => {
    if (error instanceof OfflineError || error instanceof SessionError) return false
    if (error instanceof HttpError) return error.status === 429 || (error.status >= 500 && (safe || SAFE.has(method)))
    // `fetch` rejects with a TypeError when the connection fails.
    return safe || SAFE.has(method)
  }

  async function request<T>(method: string, path: string, options: Internal = {}): Promise<T> {
    let refreshed = false
    for (let attempt = 0; ; attempt += 1) {
      options.signal?.throwIfAborted()
      let error: unknown
      try {
        const response = await send(method, path, options)
        if (response.ok) {
          log('request', `${method} ${path} → ${response.status}`)
          return (await response.json()) as T
        }
        error = await failure(response)
      } catch (thrown) {
        if (isAbort(thrown, options.signal)) throw thrown
        error = thrown
      }
      // An expired access token: refresh it, once, and send the request again.
      if (options.auth && !refreshed && error instanceof HttpError && error.status === 401) {
        refreshed = true
        attempt -= 1
        log('refresh', `${method} ${path} → 401: refreshing the access token`)
        await refresh()
        continue
      }
      if (attempt >= RETRIES || !mayRetry(error, method, options.safe)) {
        log('failed', `${method} ${path}: ${error instanceof Error ? error.message : String(error)}`)
        throw error
      }
      const wait = (error instanceof HttpError && error.retryAfter) || backoff * 2 ** attempt * (0.5 + random() / 2)
      log('retry', `${method} ${path}: ${error instanceof HttpError ? error.status : 'no connection'}, retry ${attempt + 1} of ${RETRIES} in ${Math.round(wait)} ms`)
      await sleep(wait, options.signal)
    }
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    post: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
    put: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),

    session: {
      current: (): Session | null => {
        const session = stored()
        return session && shown(session)
      },
      async signIn(credentials: Credentials): Promise<Session> {
        const { expiresInMins, expiresAt } = lifetime()
        const { accessToken, refreshToken, ...user } = await request<Tokens & User>('POST', '/auth/login', { body: { ...credentials, expiresInMins } })
        const session = { user: { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, image: user.image }, accessToken, refreshToken, expiresAt }
        keep(session)
        return shown(session)
      },
      refresh,
      signOut: () => keep(null),
    },

    /** What the network lab reads and changes. */
    lab: {
      settings: (): Settings => ({ ...settings }),
      change: (changes: Partial<Settings>): Settings => Object.assign(settings, changes) && { ...settings },
      activity: (): Entry[] => entries,
      /** Makes the access token one the server refuses, as an expired one is: the next request that needs it refreshes. */
      expireToken() {
        const session = stored()
        if (session) keep({ ...session, accessToken: `${session.accessToken}.expired` })
      },
      /** Makes the refresh token one the server refuses: the next refresh ends the session. */
      breakRefresh() {
        const session = stored()
        if (session) keep({ ...session, refreshToken: `${session.refreshToken}.revoked` })
      },
    },
  }
}
