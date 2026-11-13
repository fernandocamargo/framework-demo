// Who may apply a bulk price change, and how large: a plain function of the backend's snapshot
// and what the form says.
import { formOf } from 'framework/testing'
import allowed from './acl'
import * as form from './form'

const at = (percent: number) => {
  const fields = formOf(form)
  fields.set('percent', percent)
  return fields
}
const snapshot = (role: 'admin' | 'moderator' | 'user' | 'guest', prices: 'update'[], priceChange: number | null) => ({
  role,
  grants: { products: ['read' as const], prices },
  limits: { priceChange },
  allowed: true,
})
const judge = (acl: ReturnType<typeof snapshot>, percent: number) => allowed({ acl, form: at(percent) } as never)

test('with no limit, any change', () => {
  expect(judge(snapshot('admin', ['update'], null), 80)).toBe(true)
})

test('within the limit the backend gives, and not beyond it', () => {
  expect(judge(snapshot('moderator', ['update'], 20), 20)).toBe(true)
  expect(judge(snapshot('moderator', ['update'], 20), 21)).toBe(false)
})

test('without the grant, none', () => {
  expect(judge(snapshot('user', [], 0), 5)).toBe(false)
})

test('a guest may try, and is asked to sign in', () => {
  expect(judge(snapshot('guest', [], 0), 80)).toBe(true)
})
