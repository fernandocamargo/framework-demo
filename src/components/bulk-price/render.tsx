import {
  Button,
  Checkbox,
  CheckboxGroup,
  Dialog,
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
  Radio,
  RadioGroup,
  Select,
  SelectValue,
} from 'react-aria-components';

export default ({
  applies,
  applyText,
  canApply,
  categories,
  className,
  current,
  failedCount,
  handlers,
  i18n,
  items,
  largeText,
  largeTitle,
  limitText,
  loadError,
  preview,
  progress,
  results,
  retryText,
  ruleProblem,
  selectedIds,
  selectionText,
  state,
  step,
  steps,
  stepText,
  summaryText,
  values,
}) => (
  <ModalOverlay
    isDismissable={!state.applying}
    isKeyboardDismissDisabled={state.applying}
    isOpen
    onOpenChange={handlers.dismiss}
  >
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog>
        {/* The whole change, as schema.org names it: prices replaced, step by step. */}
        <div itemScope itemType="https://schema.org/ReplaceAction">
          <header>
            <hgroup>
              <Heading slot="title">
                <span itemProp="name">{i18n.title}</span>
              </Heading>
              <p>{stepText}</p>
            </hgroup>
            <Button isDisabled={state.applying} slot="close">
              {i18n.close}
            </Button>
          </header>
          <ol aria-hidden="true" itemProp="actionProcess" itemScope itemType="https://schema.org/HowTo">
            {steps.map((step) => (
              <li
                aria-current={step.current ? 'step' : undefined}
                itemProp="step"
                itemScope
                itemType="https://schema.org/HowToStep"
                key={step.label}
              >
                <span itemProp="name">{step.label}</span>
              </li>
            ))}
          </ol>

          {step === 1 && (
            <>
              <Select onSelectionChange={handlers.chooseCategory} selectedKey={values.category}>
                <Label>{i18n.choose.category}</Label>
                <Button>
                  <SelectValue />
                </Button>
                <Popover>
                  <ListBox items={categories}>
                    {(category) => <ListBoxItem id={category.slug}>{category.name}</ListBoxItem>}
                  </ListBox>
                </Popover>
              </Select>
              {state.loadingProducts ? (
                <div aria-busy="true" aria-label={i18n.choose.loading} />
              ) : loadError ? (
                <div itemScope itemType="https://schema.org/SearchAction" role="alert">
                  <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
                  <p itemProp="error">{i18n.choose.failed({ message: loadError })}</p>
                  <menu>
                    <li>
                      <Button onPress={handlers.retryLoad}>{i18n.choose.retry}</Button>
                    </li>
                  </menu>
                </div>
              ) : (
                <CheckboxGroup onChange={handlers.selectProducts} value={selectedIds}>
                  <Label>{selectionText}</Label>
                  <div>
                    {items.map((item) => (
                      <Checkbox key={item.id} value={String(item.id)}>
                        <span itemScope itemType="https://schema.org/Product">
                          <span itemProp="name">{item.title}</span>
                          <span itemProp="offers" itemScope itemType="https://schema.org/Offer">
                            <data itemProp="price" value={item.price.value}>
                              {item.price.text}
                            </data>
                          </span>
                        </span>
                      </Checkbox>
                    ))}
                  </div>
                </CheckboxGroup>
              )}
              <footer>
                <Button onPress={handlers.closeWizard}>{i18n.cancel}</Button>
                <Button isDisabled={!state.choosing || selectedIds.length === 0} onPress={handlers.goNext}>
                  {i18n.choose.next}
                </Button>
              </footer>
            </>
          )}

          {step === 2 && (
            <>
              <fieldset>
                <RadioGroup onChange={handlers.setDirection} value={values.direction}>
                  <Label>{i18n.rule.direction}</Label>
                  <Radio value="decrease">{i18n.rule.decrease}</Radio>
                  <Radio value="increase">{i18n.rule.increase}</Radio>
                </RadioGroup>
                <NumberField
                  formatOptions={{ style: 'unit', unit: 'percent' }}
                  isInvalid={Boolean(ruleProblem)}
                  minValue={0}
                  onChange={handlers.setPercent}
                  step={1}
                  value={values.percent}
                >
                  <Label>{i18n.rule.by}</Label>
                  <Group>
                    <Input />
                    <Button slot="decrement">−</Button>
                    <Button slot="increment">+</Button>
                  </Group>
                </NumberField>
              </fieldset>
              {ruleProblem && <p role="alert">{ruleProblem}</p>}
              <footer>
                <Button onPress={handlers.goBack}>{i18n.back}</Button>
                <Button isDisabled={Boolean(ruleProblem)} onPress={handlers.goNext}>
                  {i18n.rule.next}
                </Button>
              </footer>
            </>
          )}

          {step === 3 && (
            <>
              <p>
                {applies((chunks) => (
                  <strong>{chunks}</strong>
                ))}
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{i18n.preview.product}</th>
                    <th scope="col">{i18n.preview.now}</th>
                    <th scope="col">{i18n.preview.after}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr itemScope itemType="https://schema.org/ReplaceAction" key={row.id}>
                      <th itemProp="object" scope="row">
                        {row.title}
                      </th>
                      <td itemProp="replacee">{row.from}</td>
                      <td itemProp="replacer">
                        <strong>{row.to}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {limitText && <p role="note">{limitText}</p>}
              <footer>
                <Button onPress={handlers.goBack}>{i18n.back}</Button>
                <Button isDisabled={!canApply} onPress={handlers.applyChange}>
                  <span itemScope itemType="https://schema.org/ReplaceAction">
                    <span itemProp="name">{applyText}</span>
                  </span>
                </Button>
              </footer>
            </>
          )}

          {step >= 4 && (
            <>
              {state.summary ? (
                <div role="status">
                  <link
                    href={
                      failedCount ? 'https://schema.org/FailedActionStatus' : 'https://schema.org/CompletedActionStatus'
                    }
                    itemProp="actionStatus"
                  />
                  <p>{summaryText}</p>
                </div>
              ) : (
                <p>
                  <span>{current ?? progress.text}</span>
                  <progress aria-label={i18n.progress.label} max={progress.total} value={progress.value}>
                    {progress.text}
                  </progress>
                </p>
              )}
              <ul aria-label={i18n.results}>
                {results.map((result) => (
                  <li itemScope itemType="https://schema.org/ReplaceAction" key={result.id}>
                    <link
                      href={
                        result.error === null
                          ? 'https://schema.org/CompletedActionStatus'
                          : 'https://schema.org/FailedActionStatus'
                      }
                      itemProp="actionStatus"
                    />
                    <span itemProp="object">{result.title}</span>
                    {result.error === null ? (
                      <span>
                        <span itemProp="replacee">{result.from}</span> →{' '}
                        <strong itemProp="replacer">{result.to}</strong>
                      </span>
                    ) : (
                      <span itemProp="error">{result.error}</span>
                    )}
                  </li>
                ))}
              </ul>
              {state.summary && (
                <footer>
                  {failedCount > 0 && <Button onPress={handlers.retryFailed}>{retryText}</Button>}
                  <Button onPress={handlers.closeWizard}>{i18n.done}</Button>
                </footer>
              )}
            </>
          )}
        </div>
      </Dialog>

      <ModalOverlay isOpen={state.confirmingLargeChange} onOpenChange={handlers.dismissLargeChange}>
        <Modal>
          <Dialog role="alertdialog">
            <Heading slot="title">{largeTitle}</Heading>
            <p>
              {largeText((chunks) => (
                <strong>{chunks}</strong>
              ))}
            </p>
            <footer>
              <Button autoFocus onPress={handlers.goBack}>
                {i18n.large.back}
              </Button>
              <Button onPress={handlers.confirmLargeChange}>
                <span itemScope itemType="https://schema.org/ReplaceAction">
                  <span itemProp="name">{i18n.large.confirm}</span>
                </span>
              </Button>
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Modal>
  </ModalOverlay>
);
