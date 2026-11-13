// The sign-in form's fields, and the credentials they make.
import type { Credentials } from '@/clients/dummyjson/http'

export const seed = (_: undefined) => ({ username: '', password: '' })

export const payload = (values: ReturnType<typeof seed>): Credentials => ({ username: values.username.trim(), password: values.password })

/** DummyJSON's public demo account. The memory world has the same one. */
export const DEMO: Credentials = { username: 'emilys', password: 'emilyspass' }
