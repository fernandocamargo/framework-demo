import { Button, Dialog, Form, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components'
import { go } from '@/address'

export default ({ className, i18n, send, values, set, signedIn, name, picture, role, token, refreshing, dialogOpen, signingIn, notice, accounts, error }) => (
  <div className={className}>
    {signedIn ? (
      <>
        <div className="who">
          {picture ? <img src={picture} alt="" width="30" height="30" /> : <span className="icon" data-icon="user" />}
          <div>
            <strong>
              {name}
              {role && <span className="badge" data-tone="accent">{role}</span>}
            </strong>
            <span className="token" data-refreshing={refreshing || undefined} role="timer" aria-live="off">
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
    <ModalOverlay className="react-aria-ModalOverlay above" data-react-aria-top-layer="true" isOpen={dialogOpen} isDismissable={!signingIn} onOpenChange={(open) => !open && send({ type: 'cancel' })}>
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
              event.preventDefault()
              send({ type: 'signIn' })
            }}
          >
            <TextField name="username" value={values.username} onChange={(value) => set('username', value)} isRequired autoFocus autoComplete="username">
              <Label>{i18n.dialog.username}</Label>
              <Input />
            </TextField>
            <TextField name="password" type="password" value={values.password} onChange={(value) => set('password', value)} isRequired autoComplete="current-password">
              <Label>{i18n.dialog.password}</Label>
              <Input />
            </TextField>
          </Form>
          <div className="hint">
            <p>{i18n.dialog.hint}</p>
            <div className="accounts">
              {accounts.map((account) => (
                <Button key={account.username} className="react-aria-Link" onPress={() => send({ type: 'fillDemo', username: account.username })}>
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
            <Button type="submit" form="sign-in" data-variant="primary" isPending={signingIn}>
              {signingIn && <span className="spinner" aria-hidden="true" />}
              {i18n.dialog.submit}
            </Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </div>
)
