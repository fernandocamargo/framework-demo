// A session and the route's pattern decide whether a mutation asks for sign-in.
export default async ({ env, route, services }) => ({
  pattern: route.pattern,
  session: await services.auth.session(),
  signin: route.signin,
  world: env.world,
});
