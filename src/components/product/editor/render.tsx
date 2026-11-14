import {
  Button,
  Dialog,
  FieldError,
  Form,
  Group,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  NumberField,
  Popover,
  Select,
  SelectValue,
  TextArea,
  TextField,
} from 'react-aria-components';

export default ({
  busy,
  categories,
  className,
  confirmingDiscard,
  conflict,
  currency,
  error,
  failed,
  formShown,
  heading,
  i18n,
  initial,
  loading,
  locked,
  problems,
  readOnly,
  saveText,
  send,
  set,
  unavailable,
}) => (
  <ModalOverlay
    isDismissable={!busy}
    isKeyboardDismissDisabled={busy}
    isOpen
    onOpenChange={(open) => !open && send({ type: 'close' })}
  >
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog>
        <header>
          <Heading slot="title">{heading}</Heading>
          <Button aria-label={i18n.close} data-variant="icon" isDisabled={busy} onPress={() => send({ type: 'close' })}>
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
            onSubmit={(event) => {
              event.preventDefault();
              send({ type: 'save' });
            }}
            validationErrors={problems}
          >
            <div className="fields">
              <TextField
                autoFocus
                className="react-aria-TextField wide"
                defaultValue={initial.title}
                isReadOnly={locked}
                name="title"
                onChange={(value) => set('title', value)}
              >
                <Label>{i18n.fields.title}</Label>
                <Input />
                <FieldError />
              </TextField>
              <TextField
                className="react-aria-TextField wide"
                defaultValue={initial.description}
                isReadOnly={locked}
                name="description"
                onChange={(value) => set('description', value)}
              >
                <Label>{i18n.fields.description}</Label>
                <TextArea />
              </TextField>
              <Select
                defaultSelectedKey={initial.category || null}
                isDisabled={locked}
                name="category"
                onSelectionChange={(key) => set('category', String(key))}
                placeholder={i18n.fields.choose}
              >
                <Label>{i18n.fields.category}</Label>
                <Button>
                  <SelectValue />
                  <span className="icon" data-icon="chevron" />
                </Button>
                <FieldError />
                <Popover>
                  <ListBox items={categories}>
                    {(category) => <ListBoxItem id={category.slug}>{category.name}</ListBoxItem>}
                  </ListBox>
                </Popover>
              </Select>
              <TextField
                defaultValue={initial.brand}
                isReadOnly={locked}
                name="brand"
                onChange={(value) => set('brand', value)}
              >
                <Label>{i18n.fields.brand}</Label>
                <Input />
              </TextField>
              <NumberField
                defaultValue={initial.price}
                formatOptions={currency}
                isReadOnly={locked}
                minValue={0}
                name="price"
                onChange={(value) => set('price', value)}
                step={0.01}
              >
                <Label>{i18n.fields.price}</Label>
                <Group>
                  <Input />
                  <Button slot="decrement">−</Button>
                  <Button slot="increment">+</Button>
                </Group>
                <FieldError />
              </NumberField>
              <NumberField
                defaultValue={initial.stock}
                isReadOnly={locked}
                minValue={0}
                name="stock"
                onChange={(value) => set('stock', value)}
                step={1}
              >
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
            <Button data-variant="primary" form="product" isDisabled={readOnly} isPending={busy} type="submit">
              {busy && <span aria-hidden="true" className="spinner" />}
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
);
