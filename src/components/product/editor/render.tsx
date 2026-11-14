import { Button, Dialog, FieldError, Form, Group, Heading, Input, Label, ListBox, ListBoxItem, Modal, ModalOverlay, NumberField, Popover, Select, SelectValue, TextArea, TextField } from 'react-aria-components'

export default ({ className, i18n, send, initial, set, categories, currency, heading, saveText, problems, loading, unavailable, formShown, locked, readOnly, busy, conflict, failed, confirmingDiscard, error }) => (
  <ModalOverlay isOpen isDismissable={!busy} isKeyboardDismissDisabled={busy} onOpenChange={(open) => !open && send({ type: 'close' })}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog>
        <header>
          <Heading slot="title">{heading}</Heading>
          <Button data-variant="icon" aria-label={i18n.close} isDisabled={busy} onPress={() => send({ type: 'close' })}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>

        {loading && (
          <div aria-busy="true" aria-label={i18n.loading} className="fields">
            <div className="skeleton wide" style={{ blockSize: '2.4rem' }} />
            <div className="skeleton wide" style={{ blockSize: '5.5rem' }} />
            <div className="skeleton" style={{ blockSize: '2.4rem' }} />
            <div className="skeleton" style={{ blockSize: '2.4rem' }} />
          </div>
        )}

        {unavailable && (
          <div className="notice" data-tone="danger" role="alert">
            <span className="icon" data-icon="alert" />
            <div>
              <p>{i18n.unavailable.message({ message: error })}</p>
              <div className="actions">
                <Button onPress={() => send({ type: 'retry' })}>{i18n.unavailable.retry}</Button>
              </div>
            </div>
          </div>
        )}

        {formShown && readOnly && (
          <p className="notice" data-tone="info" role="note">
            <span className="icon" data-icon="user" />
            {i18n.readOnly}
          </p>
        )}

        {formShown && (
          <Form
            id="product"
            validationErrors={problems}
            onSubmit={(event) => {
              event.preventDefault()
              send({ type: 'save' })
            }}
          >
            <div className="fields">
              <TextField className="react-aria-TextField wide" name="title" defaultValue={initial.title} onChange={(value) => set('title', value)} isReadOnly={locked} autoFocus>
                <Label>{i18n.fields.title}</Label>
                <Input />
                <FieldError />
              </TextField>
              <TextField className="react-aria-TextField wide" name="description" defaultValue={initial.description} onChange={(value) => set('description', value)} isReadOnly={locked}>
                <Label>{i18n.fields.description}</Label>
                <TextArea />
              </TextField>
              <Select name="category" defaultSelectedKey={initial.category || null} onSelectionChange={(key) => set('category', String(key))} isDisabled={locked} placeholder={i18n.fields.choose}>
                <Label>{i18n.fields.category}</Label>
                <Button>
                  <SelectValue />
                  <span className="icon" data-icon="chevron" />
                </Button>
                <FieldError />
                <Popover>
                  <ListBox items={categories}>{(category) => <ListBoxItem id={category.slug}>{category.name}</ListBoxItem>}</ListBox>
                </Popover>
              </Select>
              <TextField name="brand" defaultValue={initial.brand} onChange={(value) => set('brand', value)} isReadOnly={locked}>
                <Label>{i18n.fields.brand}</Label>
                <Input />
              </TextField>
              <NumberField name="price" defaultValue={initial.price} onChange={(value) => set('price', value)} minValue={0} step={0.01} formatOptions={currency} isReadOnly={locked}>
                <Label>{i18n.fields.price}</Label>
                <Group>
                  <Input />
                  <Button slot="decrement">−</Button>
                  <Button slot="increment">+</Button>
                </Group>
                <FieldError />
              </NumberField>
              <NumberField name="stock" defaultValue={initial.stock} onChange={(value) => set('stock', value)} minValue={0} step={1} isReadOnly={locked}>
                <Label>{i18n.fields.stock}</Label>
                <Group>
                  <Input />
                  <Button slot="decrement">−</Button>
                  <Button slot="increment">+</Button>
                </Group>
                <FieldError />
              </NumberField>
            </div>
          </Form>
        )}

        {conflict && (
          <div className="notice" data-tone="warn" role="alert">
            <span className="icon" data-icon="alert" />
            <div>
              <p>{i18n.conflict.message}</p>
              <div className="actions">
                <Button onPress={() => send({ type: 'takeTheirs' })}>{i18n.conflict.theirs}</Button>
                <Button data-variant="primary" onPress={() => send({ type: 'keepMine' })}>
                  {i18n.conflict.mine}
                </Button>
              </div>
            </div>
          </div>
        )}

        {failed && (
          <div className="notice" data-tone="danger" role="alert">
            <span className="icon" data-icon="alert" />
            <div>
              <p>{i18n.failed.message({ message: error })}</p>
              <div className="actions">
                <Button onPress={() => send({ type: 'edit' })}>{i18n.failed.back}</Button>
                <Button data-variant="primary" onPress={() => send({ type: 'retry' })}>
                  {i18n.failed.retry}
                </Button>
              </div>
            </div>
          </div>
        )}

        {formShown && !conflict && !failed && (
          <footer>
            <Button isDisabled={busy} onPress={() => send({ type: 'close' })}>
              {i18n.cancel}
            </Button>
            <Button type="submit" form="product" data-variant="primary" isPending={busy} isDisabled={readOnly}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {saveText}
            </Button>
          </footer>
        )}
      </Dialog>

      <ModalOverlay isOpen={confirmingDiscard} onOpenChange={(open) => !open && send({ type: 'keepEditing' })}>
        <Modal data-size="small">
          <Dialog role="alertdialog">
            <Heading slot="title">{i18n.discard.title}</Heading>
            <p>{i18n.discard.text}</p>
            <footer>
              <Button autoFocus onPress={() => send({ type: 'keepEditing' })}>
                {i18n.discard.keep}
              </Button>
              <Button data-variant="danger" onPress={() => send({ type: 'discard' })}>
                {i18n.discard.discard}
              </Button>
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Modal>
  </ModalOverlay>
)
