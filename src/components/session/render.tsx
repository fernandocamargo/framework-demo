import { Button, Dialog, Form, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components';

import DemoAccount from './components/demo-account';

export default ({
  accounts,
  className,
  dialogOpen,
  error,
  handlers,
  i18n,
  name,
  notice,
  picture,
  refreshing,
  role,
  signedIn,
  signingIn,
  token,
  values,
}) => (
  <div className={className}>
    {signedIn ? (
      <>
        {/* Who is signed in, as schema.org names a person. */}
        <div itemScope itemType="https://schema.org/Person">
          {picture && <img alt="" height="30" itemProp="image" src={picture} width="30" />}
          <div>
            <strong>
              <span itemProp="name">{name}</span>
              {role && <small itemProp="jobTitle">{role}</small>}
            </strong>
            <span aria-busy={refreshing || undefined} aria-live="off" role="timer">
              {token}
            </span>
          </div>
        </div>
        <Button onPress={handlers.signOut}>{i18n.signOut}</Button>
      </>
    ) : (
      <Button onPress={handlers.openSignIn}>{i18n.signIn}</Button>
    )}
    {/* Signing in can be asked for while another dialog opens (a change that needs a session).
        Marked top layer, it stays usable and above that dialog, whichever of the two opened last. */}
    <ModalOverlay
      data-react-aria-top-layer="true"
      isDismissable={!signingIn}
      isOpen={dialogOpen}
      onOpenChange={handlers.dismiss}
    >
      <Modal className={`react-aria-Modal ${className}`}>
        <Dialog>
          <Heading slot="title">{i18n.dialog.title}</Heading>
          {notice && <p role="alert">{notice}</p>}
          <Form id="sign-in" onSubmit={handlers.signIn}>
            <TextField
              autoComplete="username"
              autoFocus
              isRequired
              name="username"
              onChange={handlers.setUsername}
              value={values.username}
            >
              <Label>{i18n.dialog.username}</Label>
              <Input />
            </TextField>
            <TextField
              autoComplete="current-password"
              isRequired
              name="password"
              onChange={handlers.setPassword}
              type="password"
              value={values.password}
            >
              <Label>{i18n.dialog.password}</Label>
              <Input />
            </TextField>
          </Form>
          <aside>
            <p>{i18n.dialog.hint}</p>
            <menu>
              {accounts.map((account) => (
                <DemoAccount account={account} fill={handlers.fillDemo} key={account.username} />
              ))}
            </menu>
          </aside>
          {error && (
            <div itemScope itemType="https://schema.org/Action" role="alert">
              <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
              <p itemProp="error">{error}</p>
            </div>
          )}
          <footer>
            <Button isDisabled={signingIn} onPress={handlers.cancel}>
              {i18n.dialog.cancel}
            </Button>
            <Button form="sign-in" isPending={signingIn} type="submit">
              {i18n.dialog.submit}
            </Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </div>
);
