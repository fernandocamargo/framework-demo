import { Button, Dialog, FieldError, Form, Group, Heading, Input, Label, ListBox, ListBoxItem, Modal, ModalOverlay, NumberField, Popover, Select, SelectValue, TextArea, TextField } from 'react-aria-components'

export default ({ className, send, values, set, categories, heading, saveText, problems, loading, unavailable, formShown, locked, busy, conflict, failed, confirmingDiscard, error }) => (
  <ModalOverlay isOpen isDismissable={!busy} isKeyboardDismissDisabled={busy} onOpenChange={(open) => !open && send({ type: 'close' })}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog>
        <header>
          <Heading slot="title">{heading}</Heading>
          <Button data-variant="icon" aria-label="Close" isDisabled={busy} onPress={() => send({ type: 'close' })}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>

        {loading && (
          <div aria-busy="true" aria-label="Reading the product" className="fields">
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
              <p>The product could not be read: {error}</p>
              <div className="actions">
                <Button onPress={() => send({ type: 'retry' })}>Try again</Button>
              </div>
            </div>
          </div>
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
              <TextField className="react-aria-TextField wide" name="title" value={values.title} onChange={(value) => set('title', value)} isReadOnly={locked} autoFocus>
                <Label>Title</Label>
                <Input />
                <FieldError />
              </TextField>
              <TextField className="react-aria-TextField wide" name="description" value={values.description} onChange={(value) => set('description', value)} isReadOnly={locked}>
                <Label>Description</Label>
                <TextArea />
              </TextField>
              <Select name="category" selectedKey={values.category || null} onSelectionChange={(key) => set('category', String(key))} isDisabled={locked} placeholder="Choose one">
                <Label>Category</Label>
                <Button>
                  <SelectValue />
                  <span className="icon" data-icon="chevron" />
                </Button>
                <FieldError />
                <Popover>
                  <ListBox items={categories}>{(category) => <ListBoxItem id={category.slug}>{category.name}</ListBoxItem>}</ListBox>
                </Popover>
              </Select>
              <TextField name="brand" value={values.brand} onChange={(value) => set('brand', value)} isReadOnly={locked}>
                <Label>Brand</Label>
                <Input />
              </TextField>
              <NumberField name="price" value={values.price} onChange={(value) => set('price', value)} minValue={0} step={0.01} formatOptions={{ style: 'currency', currency: 'USD' }} isReadOnly={locked}>
                <Label>Price</Label>
                <Group>
                  <Input />
                  <Button slot="decrement">−</Button>
                  <Button slot="increment">+</Button>
                </Group>
                <FieldError />
              </NumberField>
              <NumberField name="stock" value={values.stock} onChange={(value) => set('stock', value)} minValue={0} step={1} isReadOnly={locked}>
                <Label>Stock</Label>
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
              <p>Somebody else changed this product while you were editing it. Your changes are still here.</p>
              <div className="actions">
                <Button onPress={() => send({ type: 'takeTheirs' })}>Discard mine and reload</Button>
                <Button data-variant="primary" onPress={() => send({ type: 'keepMine' })}>
                  Save mine anyway
                </Button>
              </div>
            </div>
          </div>
        )}

        {failed && (
          <div className="notice" data-tone="danger" role="alert">
            <span className="icon" data-icon="alert" />
            <div>
              <p>It was not saved: {error}</p>
              <div className="actions">
                <Button onPress={() => send({ type: 'edit' })}>Back to the form</Button>
                <Button data-variant="primary" onPress={() => send({ type: 'retry' })}>
                  Try again
                </Button>
              </div>
            </div>
          </div>
        )}

        {formShown && !conflict && !failed && (
          <footer>
            <Button isDisabled={busy} onPress={() => send({ type: 'close' })}>
              Cancel
            </Button>
            <Button type="submit" form="product" data-variant="primary" isPending={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {saveText}
            </Button>
          </footer>
        )}
      </Dialog>

      <ModalOverlay isOpen={confirmingDiscard} onOpenChange={(open) => !open && send({ type: 'keepEditing' })}>
        <Modal data-size="small">
          <Dialog role="alertdialog">
            <Heading slot="title">Discard your changes?</Heading>
            <p>What you changed in this product has not been saved.</p>
            <footer>
              <Button autoFocus onPress={() => send({ type: 'keepEditing' })}>
                Keep editing
              </Button>
              <Button data-variant="danger" onPress={() => send({ type: 'discard' })}>
                Discard
              </Button>
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Modal>
  </ModalOverlay>
)
