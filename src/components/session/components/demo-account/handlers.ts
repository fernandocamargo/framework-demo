// A demo account's button asks its parent to fill the form in with that account.
export const fill =
  ({ account, fill }) =>
  () =>
    fill(account.username);
