import { Button, Dialog, Form, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components'
import { go } from '@/address'
import { DEMO } from './form'

export default ({ className, send, values, set, signedIn, name, picture, token, refreshing, dialogOpen, signingIn, notice, error }) => (
  <div className={className}>
    {signedIn ? (
      <>
        <div className="who">
          {picture ? <img src={picture} alt="" width="30" height="30" /> : <span className="icon" data-icon="user" />}
          <div>
            <strong>{name}</strong>
            <span className="token" data-refreshing={refreshing || undefined} role="timer" aria-live="off">
              {token}
            </span>
          </div>
        </div>
        <Button data-variant="quiet" onPress={() => send({ type: 'signOut' })}>
          Sign out
        </Button>
      </>
    ) : (
      <Button onPress={() => go({ signin: true })}>
        <span className="icon" data-icon="user" />
        Sign in
      </Button>
    )}

    {/* Signing in can be asked for while another dialog opens (a change that needs a session).
        Marked top layer, it stays usable and above that dialog, whichever of the two opened last. */}
    <ModalOverlay className="react-aria-ModalOverlay above" data-react-aria-top-layer="true" isOpen={dialogOpen} isDismissable={!signingIn} onOpenChange={(open) => !open && send({ type: 'cancel' })}>
      <Modal className={`react-aria-Modal ${className} dialog`} data-size="small">
        <Dialog>
          <Heading slot="title">Sign in</Heading>
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
              <Label>Username</Label>
              <Input />
            </TextField>
            <TextField name="password" type="password" value={values.password} onChange={(value) => set('password', value)} isRequired autoComplete="current-password">
              <Label>Password</Label>
              <Input />
            </TextField>
          </Form>
          <p className="hint">
            DummyJSON's demo account is public: <code>{DEMO.username}</code> / <code>{DEMO.password}</code>.{' '}
            <Button className="react-aria-Link" onPress={() => send({ type: 'fillDemo' })}>
              Fill it in
            </Button>
          </p>
          {error && (
            <div className="notice" data-tone="danger" role="alert">
              <span className="icon" data-icon="alert" />
              <p>{error}</p>
            </div>
          )}
          <footer>
            <Button isDisabled={signingIn} onPress={() => send({ type: 'cancel' })}>
              Cancel
            </Button>
            <Button type="submit" form="sign-in" data-variant="primary" isPending={signingIn}>
              {signingIn && <span className="spinner" aria-hidden="true" />}
              Sign in
            </Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </div>
)
