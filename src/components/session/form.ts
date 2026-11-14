// The sign-in form's fields, and the credentials they make.

import type { Credentials } from '@/clients/dummyjson/http'

export const seed = (_: undefined) => ({ username: '', password: '' })

export const payload = (values: ReturnType<typeof seed>): Credentials => ({ username: values.username.trim(), password: values.password })

/** DummyJSON's public demo accounts, one per role. The memory world has the same ones. */
export const DEMOS = [
  { username: 'emilys', password: 'emilyspass', name: 'Emily', role: 'admin' },
  { username: 'oliviaw', password: 'oliviawpass', name: 'Olivia', role: 'moderator' },
  { username: 'averyp', password: 'averyppass', name: 'Avery', role: 'user' },
] as const satisfies readonly (Credentials & { name: string; role: string })[]

/** The first: an admin. */
export const DEMO: Credentials = { username: DEMOS[0].username, password: DEMOS[0].password }
