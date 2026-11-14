import { Button, Dialog, Form, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components';

import { go } from '@/address';

export default ({
  accounts,
  className,
  dialogOpen,
  error,
  i18n,
  name,
  notice,
  picture,
  refreshing,
  role,
  send,
  set,
  signedIn,
  signingIn,
  token,
  values,
}) => (
  <div className={className}>
    {signedIn ? (
      <>
        <div className="who">
          {picture ? <img alt="" height="30" src={picture} width="30" /> : <span className="icon" data-icon="user" />}
          <div>
            <strong>
              {name}
              {role && (
                <span className="badge" data-tone="accent">
                  {role}
                </span>
              )}
            </strong>
            <span aria-live="off" className="token" data-refreshing={refreshing || undefined} role="timer">
              {token}
            </span>
          </div>
        </div>
        <Button data-variant="quiet" onPress={() => send({ type: 'signOut' })}>
          {i18n.signOut}
        </Button>
      </>
    ) : (
      <Button onPress={() => go({ signin: true })}>
        <span className="icon" data-icon="user" />
        {i18n.signIn}
      </Button>
    )}

    {/* Signing in can be asked for while another dialog opens (a change that needs a session).
        Marked top layer, it stays usable and above that dialog, whichever of the two opened last. */}
    <ModalOverlay
      className="react-aria-ModalOverlay above"
      data-react-aria-top-layer="true"
      isDismissable={!signingIn}
      isOpen={dialogOpen}
      onOpenChange={(open) => !open && send({ type: 'cancel' })}
    >
      <Modal className={`react-aria-Modal ${className} dialog`} data-size="small">
        <Dialog>
          <Heading slot="title">{i18n.dialog.title}</Heading>
          {notice && (
            <div className="notice" data-tone="warn">
              <span className="icon" data-icon="alert" />
              <p>{notice}</p>
            </div>
          )}
          <Form
            id="sign-in"
            onSubmit={(event) => {
              event.preventDefault();
              send({ type: 'signIn' });
            }}
          >
            <TextField
              autoComplete="username"
              autoFocus
              isRequired
              name="username"
              onChange={(value) => set('username', value)}
              value={values.username}
            >
              <Label>{i18n.dialog.username}</Label>
              <Input />
            </TextField>
            <TextField
              autoComplete="current-password"
              isRequired
              name="password"
              onChange={(value) => set('password', value)}
              type="password"
              value={values.password}
            >
              <Label>{i18n.dialog.password}</Label>
              <Input />
            </TextField>
          </Form>
          <div className="hint">
            <p>{i18n.dialog.hint}</p>
            <div className="accounts">
              {accounts.map((account) => (
                <Button
                  className="react-aria-Link"
                  key={account.username}
                  onPress={() => send({ type: 'fillDemo', username: account.username })}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
          {error && (
            <div className="notice" data-tone="danger" role="alert">
              <span className="icon" data-icon="alert" />
              <p>{error}</p>
            </div>
          )}
          <footer>
            <Button isDisabled={signingIn} onPress={() => send({ type: 'cancel' })}>
              {i18n.dialog.cancel}
            </Button>
            <Button data-variant="primary" form="sign-in" isPending={signingIn} type="submit">
              {signingIn && <span aria-hidden="true" className="spinner" />}
              {i18n.dialog.submit}
            </Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </div>
);
