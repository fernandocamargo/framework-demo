// What the page needs before it shows: who is signed in, and which dialogs the address opens.
// The framework records what this read: `auth.session` and these route fields. So a sign-in
// or a sign-out reads it again, and a change of filter does not.
export default async ({ services, route, env }) => ({
  world: env.world,
  session: await services.auth.session(),
  signin: route.signin,
  dialogs: { view: route.view, edit: route.edit, create: route.create, remove: route.remove, bulk: route.bulk },
})
