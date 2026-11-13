// Who may apply a bulk price change, and how large: a plain function of who is signed in and
// what the form says.
import { formOf } from 'framework/testing'
import allowed from './acl'
import * as form from './form'

const at = (percent: number) => {
  const fields = formOf(form)
  fields.set('percent', percent)
  return fields
}
const person = (role: 'admin' | 'moderator' | 'user') => ({ id: 1, username: role, firstName: '', lastName: '', image: '', role })
const judge = (user: ReturnType<typeof person> | null, percent: number) => allowed({ user, form: at(percent) } as never)

test('admins apply any change', () => {
  expect(judge(person('admin'), 80)).toBe(true)
})

test('moderators apply changes up to 20%', () => {
  expect(judge(person('moderator'), 20)).toBe(true)
  expect(judge(person('moderator'), 21)).toBe(false)
})

test('users apply none', () => {
  expect(judge(person('user'), 5)).toBe(false)
})

test('nobody signed in may try, and is asked to sign in', () => {
  expect(judge(null, 80)).toBe(true)
})
