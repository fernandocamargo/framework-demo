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
  saves,
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
          <Button isDisabled={busy} slot="close">
            {i18n.close}
          </Button>
        </header>

        {loading && (
          <div aria-busy="true" aria-label={i18n.loading}>
            <div />
            <div />
            <div />
            <div />
          </div>
        )}

        {unavailable && (
          <div itemScope itemType="https://schema.org/ReadAction" role="alert">
            <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
            <p itemProp="error">{i18n.unavailable.message({ message: error })}</p>
            <menu>
              <li>
                <Button onPress={() => send({ type: 'retry' })}>{i18n.unavailable.retry}</Button>
              </li>
            </menu>
          </div>
        )}

        {formShown && readOnly && <p role="note">{i18n.readOnly}</p>}

        {formShown && (
          <Form
            id="product"
            onSubmit={(event) => {
              event.preventDefault();
              send({ type: 'save' });
            }}
            validationErrors={problems}
          >
            <fieldset>
              <TextField
                autoFocus
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
            </fieldset>
          </Form>
        )}

        {conflict && (
          <div itemScope itemType="https://schema.org/UpdateAction" role="alert">
            <link href="https://schema.org/ActiveActionStatus" itemProp="actionStatus" />
            <p itemProp="description">{i18n.conflict.message}</p>
            <menu>
              <li>
                <Button onPress={() => send({ type: 'takeTheirs' })}>{i18n.conflict.theirs}</Button>
              </li>
              <li>
                <Button onPress={() => send({ type: 'keepMine' })}>{i18n.conflict.mine}</Button>
              </li>
            </menu>
          </div>
        )}

        {failed && (
          <div itemScope itemType={saves} role="alert">
            <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
            <p itemProp="error">{i18n.failed.message({ message: error })}</p>
            <menu>
              <li>
                <Button onPress={() => send({ type: 'edit' })}>{i18n.failed.back}</Button>
              </li>
              <li>
                <Button onPress={() => send({ type: 'retry' })}>{i18n.failed.retry}</Button>
              </li>
            </menu>
          </div>
        )}

        {formShown && !conflict && !failed && (
          <footer>
            <Button isDisabled={busy} onPress={() => send({ type: 'close' })}>
              {i18n.cancel}
            </Button>
            <Button form="product" isDisabled={readOnly} isPending={busy} type="submit">
              <span itemScope itemType={saves}>
                <span itemProp="name">{saveText}</span>
              </span>
            </Button>
          </footer>
        )}
      </Dialog>

      <ModalOverlay isOpen={confirmingDiscard} onOpenChange={(open) => !open && send({ type: 'keepEditing' })}>
        <Modal>
          <Dialog role="alertdialog">
            <Heading slot="title">{i18n.discard.title}</Heading>
            <p>{i18n.discard.text}</p>
            <footer>
              <Button autoFocus onPress={() => send({ type: 'keepEditing' })}>
                {i18n.discard.keep}
              </Button>
              <Button onPress={() => send({ type: 'discard' })}>
                <span itemScope itemType="https://schema.org/DeleteAction">
                  <span itemProp="name">{i18n.discard.discard}</span>
                </span>
              </Button>
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Modal>
  </ModalOverlay>
);
