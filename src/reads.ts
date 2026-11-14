// What `Root` reads for this app, beside what the address and the shell give it: who is signed in,
// what the backend says they may do, and the flags they get. The shell (main.tsx) and Storybook's
// preview (.storybook/preview.tsx) hand the same three to their `Root`.

import type { Acl, Flags, Injection, User } from 'framework'

// Who is signed in: the session the API client holds, then the profile it names, which carries
// the role. Both are reads of the auth service, so a sign-in or a sign-out reads this again, and
// only the components whose files read `user` render again.
export const whoIsSignedIn = async ({ services }: Injection): Promise<User | null> => ((await services.auth.session()) ? services.auth.profile() : null)

// What the backend says may be done. The app does not own it: the framework carries it to every
// component that reads `acl`, and each tests its own rules against it.
export const permissions = ({ services }: Injection): Promise<Acl> => services.auth.permissions()

// The flags this person gets. The provider targets them by id and by the role the backend gives
// them, so they are read after both, and again when either changes; a flag served another way
// reads them again too (services/flags/meta.ts).
export const featureFlags = async ({ services, user }: Injection & { user: User | null }): Promise<Flags> =>
  services.flags.evaluate({ targetingKey: user ? String(user.id) : 'guest', role: (await services.auth.permissions()).role })
