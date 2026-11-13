// Who may apply a bulk price change, and how large: admins, any change; moderators, up to
// MODERATOR_LIMIT; everyone else, none. The rule reads the form, so it changes as the person
// types the percentage. Nobody signed in may still try, and is asked to sign in.
import { MODERATOR_LIMIT } from './rule'

export default ({ user, form }) => user === null || user.role === 'admin' || (user.role === 'moderator' && form.values.percent <= MODERATOR_LIMIT)
