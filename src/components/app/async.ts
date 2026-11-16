export default async ({ env, services }) => ({ session: await services.auth.session(), world: env.world });
