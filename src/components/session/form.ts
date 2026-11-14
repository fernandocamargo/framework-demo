// The sign-in form's fields, and the credentials they make.

import type { Credentials } from '@/clients/dummyjson/http';

export const seed = (_: undefined) => ({ password: '', username: '' });

export const payload = (values: ReturnType<typeof seed>): Credentials => ({
  password: values.password,
  username: values.username.trim(),
});

/** DummyJSON's public demo accounts, one per role. The memory world has the same ones. */
export const DEMOS = [
  { name: 'Emily', password: 'emilyspass', role: 'admin', username: 'emilys' },
  { name: 'Olivia', password: 'oliviawpass', role: 'moderator', username: 'oliviaw' },
  { name: 'Avery', password: 'averyppass', role: 'user', username: 'averyp' },
] as const satisfies readonly (Credentials & { name: string; role: string })[];

/** The first: an admin. */
export const DEMO: Credentials = { password: DEMOS[0].password, username: DEMOS[0].username };
