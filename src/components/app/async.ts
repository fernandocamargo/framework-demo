// What the page needs before it shows: who is signed in, and which dialogs the address opens.
// The framework records what this read: `auth.session` and these route fields. So a sign-in
// or a sign-out reads it again, and a change of filter does not.
export default async ({ env, route, services }) => ({
  dialogs: { bulk: route.bulk, create: route.create, edit: route.edit, remove: route.remove, view: route.view },
  section: route.section,
  session: await services.auth.session(),
  signin: route.signin,
  world: env.world,
});
