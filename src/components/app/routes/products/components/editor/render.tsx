import {
  Button,
  Dialog,
  FieldError,
  Form,
  Group,
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
  handlers,
  heading,
  i18n,
  initial,
  loading,
  locked,
  problems,
  readOnly,
  saves,
  saveText,
  unavailable,
}) => (
  <ModalOverlay isDismissable={!busy} isKeyboardDismissDisabled={busy} isOpen onOpenChange={handlers.dismiss}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog aria-label={heading}>
        <header>
          <h2>{heading}</h2>
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
                <Button onPress={handlers.retry}>{i18n.unavailable.retry}</Button>
              </li>
            </menu>
          </div>
        )}

        {formShown && readOnly && <p role="note">{i18n.readOnly}</p>}

        {formShown && (
          <Form id="product" onSubmit={handlers.save} validationErrors={problems}>
            <fieldset>
              <TextField
                autoFocus
                defaultValue={initial.title}
                isReadOnly={locked}
                name="title"
                onChange={handlers.setTitle}
              >
                <Label>{i18n.fields.title}</Label>
                <Input />
                <FieldError />
              </TextField>
              <TextField
                defaultValue={initial.description}
                isReadOnly={locked}
                name="description"
                onChange={handlers.setDescription}
              >
                <Label>{i18n.fields.description}</Label>
                <TextArea />
              </TextField>
              <Select
                defaultSelectedKey={initial.category || null}
                isDisabled={locked}
                name="category"
                onSelectionChange={handlers.setCategory}
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
              <TextField defaultValue={initial.brand} isReadOnly={locked} name="brand" onChange={handlers.setBrand}>
                <Label>{i18n.fields.brand}</Label>
                <Input />
              </TextField>
              <NumberField
                defaultValue={initial.price}
                formatOptions={currency}
                isReadOnly={locked}
                minValue={0}
                name="price"
                onChange={handlers.setPrice}
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
                onChange={handlers.setStock}
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
                <Button onPress={handlers.takeTheirs}>{i18n.conflict.theirs}</Button>
              </li>
              <li>
                <Button onPress={handlers.keepMine}>{i18n.conflict.mine}</Button>
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
                <Button onPress={handlers.backToEditing}>{i18n.failed.back}</Button>
              </li>
              <li>
                <Button onPress={handlers.retry}>{i18n.failed.retry}</Button>
              </li>
            </menu>
          </div>
        )}

        {formShown && !conflict && !failed && (
          <footer>
            <Button isDisabled={busy} onPress={handlers.close}>
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

      <ModalOverlay isOpen={confirmingDiscard} onOpenChange={handlers.dismissQuestion}>
        <Modal>
          <Dialog aria-label={i18n.discard.title} role="alertdialog">
            <h2>{i18n.discard.title}</h2>
            <p>{i18n.discard.text}</p>
            <footer>
              <Button autoFocus onPress={handlers.keepEditing}>
                {i18n.discard.keep}
              </Button>
              <Button onPress={handlers.discard}>
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
