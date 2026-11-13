import { formOf, startFlow } from 'framework/testing'
import * as form from './form'
import * as session from './state'

const user = { id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson', image: '' }
const context = (fields: Partial<ReturnType<typeof session.context>>) => ({ context: { ...session.context(), ...fields } }) as never

test('a refresh is due shortly before the access token expires, and not before a postponed one may go', () => {
  expect(session.aboutToExpire(context({ now: 1_000, expiresAt: 60_000 }))).toBe(false)
  expect(session.aboutToExpire(context({ now: 60_000 - session.REFRESH_AHEAD, expiresAt: 60_000 }))).toBe(true)
  expect(session.aboutToExpire(context({ now: 59_000, expiresAt: 60_000, notBefore: 65_000 }))).toBe(false)
})

test('only a refused refresh ends the session', () => {
  expect(session.sessionOver({ event: { error: Object.assign(new Error('expired'), { name: 'SessionError' }) } } as never)).toBe(true)
  expect(session.sessionOver({ event: { error: new Error('The network is unreachable.') } } as never)).toBe(false)
})

test('signing in remembers who and until when, clears the form and closes the dialog', async () => {
  const fields = formOf(form)
  const go = vi.fn()
  const signIn = vi.fn(async () => ({ user, expiresAt: Date.now() + 60_000 }))
  const flow = startFlow(session, { services: { auth: { session: async () => null, signIn, refresh: vi.fn(), signOut: vi.fn(async () => undefined) } }, form: fields, navigation: { go } })
  await flow.settled()
  expect(flow.states).toEqual(['signedOut'])

  flow.send({ type: 'fillDemo' })
  expect(fields.payload()).toEqual(form.DEMO)
  flow.send({ type: 'signIn' })
  await flow.settled()
  expect(signIn).toHaveBeenCalledWith(form.DEMO)
  expect(flow.states).toEqual(['signedIn'])
  expect(flow.context['user']).toEqual(user)
  expect(fields.values).toEqual({ username: '', password: '' })
  expect(go).toHaveBeenCalledWith({ signin: false })
  flow.stop()
})

test('wrong credentials stay signed out, with the reason', async () => {
  const flow = startFlow(session, {
    services: { auth: { session: async () => null, signIn: async () => Promise.reject(new Error('Invalid credentials')) } },
    form: formOf(form),
    navigation: { go: vi.fn() },
  })
  await flow.settled()
  flow.send({ type: 'signIn' })
  await flow.settled()
  expect(flow.states).toEqual(['signedOut'])
  expect(flow.context['error']).toBe('Invalid credentials')
})
