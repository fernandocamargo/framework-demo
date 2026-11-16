// The session's commands send the same chart events its dialog's buttons and fields do.
export const signOut =
  ({ state }) =>
  () =>
    state.send({ type: 'signOut' });
export const openSignIn =
  ({ navigation }) =>
  () =>
    navigation.query({ signin: true });
export const dismiss =
  ({ state }) =>
  (open: boolean) => {
    if (!open) state.send({ type: 'cancel' });
  };
export const cancel =
  ({ state }) =>
  () =>
    state.send({ type: 'cancel' });
export const signIn =
  ({ state }) =>
  (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.send({ type: 'signIn' });
  };
export const setUsername =
  ({ form }) =>
  (value: string) =>
    form.set('username', value);
export const setPassword =
  ({ form }) =>
  (value: string) =>
    form.set('password', value);
export const fillDemo =
  ({ state }) =>
  (username: string) =>
    state.send({ type: 'fillDemo', username });
