// The page's rule: changing the catalogue needs a session.
import shape from './props'

type Dialogs = { view: number | null; edit: number | null; create: boolean; remove: number | null; bulk: boolean }
const closed: Dialogs = { view: null, edit: null, create: false, remove: null, bulk: false }
const session = { user: { id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson', image: '' }, expiresAt: 0 }
const page = (answer: { session: typeof session | null; signin?: boolean; dialogs?: Partial<Dialogs> }) =>
  shape({ navigating: false, className: 'components/app', async: { default: { world: 'memory', signin: false, ...answer, dialogs: { ...closed, ...answer.dialogs } } } })

test('reading needs no session', () => {
  expect(page({ session: null, dialogs: { view: 4 } })).toMatchObject({ askToSignIn: false, signInReason: null })
})

test.each<Partial<Dialogs>>([{ edit: 4 }, { create: true }, { remove: 4 }, { bulk: true }])('%o without a session asks to sign in, and says why', (dialogs) => {
  expect(page({ session: null, dialogs })).toMatchObject({ askToSignIn: true, signInReason: 'Sign in to change the catalogue.' })
})

test('with a session, nothing asks', () => {
  expect(page({ session, signin: true, dialogs: { edit: 4 } })).toMatchObject({ askToSignIn: false, signInReason: null })
})

test('the address can ask for the sign-in dialog on its own', () => {
  expect(page({ session: null, signin: true })).toMatchObject({ askToSignIn: true, signInReason: null })
})
