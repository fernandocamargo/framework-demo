// The API client on a bad network. The wire is the memory world's server, wrapped to count
// calls and to fail on demand, so each rule is tested without a network or a clock.

import { createServer } from '../memory/server'
import { users } from '../memory/fixtures'

const [user] = users
import { memoryStorage } from '../storage'
import { createHttp, type Wire } from './http'

const credentials = { username: user!.username, password: user!.password }

function client(intercept?: (url: URL, init: RequestInit, calls: number) => Response | undefined) {
  const server = createServer()
  const calls: string[] = []
  const wire: Wire = async (address, init) => {
    const url = new URL(address)
    calls.push(`${init.method} ${url.pathname}`)
    return intercept?.(url, init, calls.length) ?? server(address, init)
  }
  // No wait between retries, and no random failure unless a test sets the rate.
  return { http: createHttp({ baseUrl: 'http://memory.invalid', wire, storage: memoryStorage(), backoff: 0, random: () => 0.5 }), calls }
}
const status = (code: number, headers: Record<string, string> = {}) => new Response(JSON.stringify({ message: `Status ${code}` }), { status: code, headers })

test('a read that meets a 500 is sent again, twice at most', async () => {
  const flaky = client((_, __, calls) => (calls <= 2 ? status(500) : undefined))
  await expect(flaky.http.get('/products/1')).resolves.toMatchObject({ id: 1 })
  expect(flaky.calls).toHaveLength(3)

  const down = client(() => status(500))
  await expect(down.http.get('/products/1')).rejects.toMatchObject({ name: 'HttpError', status: 500 })
  expect(down.calls).toHaveLength(3)
})

test('a creation that meets a 500 is not sent again, since it may have happened; a 429 is', async () => {
  const failed = client(() => status(500))
  await expect(failed.http.post('/products/add', {})).rejects.toMatchObject({ status: 500 })
  expect(failed.calls).toHaveLength(1)

  const busy = client((_, __, calls) => (calls === 1 ? status(429, { 'retry-after': '0' }) : undefined))
  await expect(busy.http.get('/products/1')).resolves.toMatchObject({ id: 1 })
  expect(busy.calls).toHaveLength(2)
})

test('a request that the API refuses is not sent again', async () => {
  const { http, calls } = client()
  await expect(http.get('/products/999')).rejects.toMatchObject({ status: 404, message: "Product with id '999' not found" })
  expect(calls).toHaveLength(1)
})

test('an aborted request stops waiting for its retry', async () => {
  const controller = new AbortController()
  const server = createServer()
  const wire: Wire = async () => new Response('{}', { status: 500 })
  const http = createHttp({ baseUrl: 'http://memory.invalid', wire: (url, init) => (controller.signal.aborted ? server(url, init) : wire(url, init)), storage: memoryStorage(), backoff: 60_000 })
  const pending = http.get('/products/1', { signal: controller.signal })
  setTimeout(() => controller.abort(), 0)
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})

test('requests that meet a 401 at the same time share one refresh, then go again', async () => {
  const { http, calls } = client()
  await http.session.signIn(credentials)
  http.lab.expireToken()
  const answers = await Promise.all([http.get('/auth/me', { auth: true }), http.put('/auth/products/1', { price: 1 }, { auth: true }), http.get('/auth/me', { auth: true })])
  expect(answers).toHaveLength(3)
  expect(calls.filter((call) => call === 'POST /auth/refresh')).toHaveLength(1)
  expect(http.lab.activity().some((entry) => entry.kind === 'refresh')).toBe(true)
})

test('a refused refresh ends the session', async () => {
  const { http } = client()
  await http.session.signIn(credentials)
  http.lab.expireToken()
  http.lab.breakRefresh()
  await expect(http.get('/auth/me', { auth: true })).rejects.toMatchObject({ name: 'SessionError' })
  expect(http.session.current()).toBeNull()
})

test('a refresh that fails for another reason leaves the session, to try again', async () => {
  const { http } = client((url) => (url.pathname === '/auth/refresh' ? status(500) : undefined))
  await http.session.signIn(credentials)
  await expect(http.session.refresh()).rejects.toMatchObject({ status: 500 })
  expect(http.session.current()).not.toBeNull()
})

test("the lab's faults: offline sends nothing, a forced status is a real answer, latency is the API's own delay", async () => {
  const { http, calls } = client()
  http.lab.change({ offline: true })
  await expect(http.get('/products/1')).rejects.toMatchObject({ name: 'OfflineError' })
  expect(calls).toHaveLength(0)

  http.lab.change({ offline: false, force: 429 })
  await expect(http.get('/products/1')).rejects.toMatchObject({ status: 429 })
  expect(calls).toEqual(['GET /http/429', 'GET /http/429', 'GET /http/429'])

  let asked = ''
  const slow = client((url) => void (asked = url.search))
  slow.http.lab.change({ latency: 1 })
  await slow.http.get('/products/1')
  expect(asked).toBe('?delay=1')
})

test('a new token lives as long as the lab says', async () => {
  const { http } = client()
  http.lab.change({ tokenMinutes: 5 })
  const before = Date.now()
  const session = await http.session.signIn(credentials)
  expect(session.user.firstName).toBe('Emily')
  expect(session.expiresAt - before).toBeGreaterThanOrEqual(5 * 60_000)
})
