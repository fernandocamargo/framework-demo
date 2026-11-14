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
  ProgressBar,
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
  set,
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
    onOpenChange={(open) => !open && state.send({ type: 'close' })}
  >
    <Modal className={`react-aria-Modal ${className}`} data-size="large">
      <Dialog>
        <header>
          <div>
            <Heading slot="title">{i18n.title}</Heading>
            <p className="step-text">{stepText}</p>
          </div>
          <Button
            aria-label={i18n.close}
            data-variant="icon"
            isDisabled={state.applying}
            onPress={() => state.send({ type: 'close' })}
          >
            <span className="icon" data-icon="close" />
          </Button>
        </header>
        <ol aria-hidden="true" className="steps">
          {steps.map((step) => (
            <li data-current={step.current || undefined} data-done={step.done || undefined} key={step.label}>
              {step.label}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <>
            <Select
              onSelectionChange={(key) => state.send({ category: String(key), type: 'categoryChanged' })}
              selectedKey={values.category}
            >
              <Label>{i18n.choose.category}</Label>
              <Button>
                <SelectValue />
                <span className="icon" data-icon="chevron" />
              </Button>
              <Popover>
                <ListBox items={categories}>
                  {(category) => <ListBoxItem id={category.slug}>{category.name}</ListBoxItem>}
                </ListBox>
              </Popover>
            </Select>
            {state.loadingProducts ? (
              <div
                aria-busy="true"
                aria-label={i18n.choose.loading}
                className="skeleton"
                style={{ blockSize: '12rem' }}
              />
            ) : loadError ? (
              <div className="notice" data-tone="danger" role="alert">
                <span className="icon" data-icon="alert" />
                <div>
                  <p>{i18n.choose.failed({ message: loadError })}</p>
                  <div className="actions">
                    <Button onPress={() => state.send({ type: 'retry' })}>{i18n.choose.retry}</Button>
                  </div>
                </div>
              </div>
            ) : (
              <CheckboxGroup onChange={(ids) => set('selected', ids.map(Number))} value={selectedIds}>
                <Label>{selectionText}</Label>
                <div className="choose">
                  {items.map((item) => (
                    <Checkbox key={item.id} value={String(item.id)}>
                      <span className="box">
                        <span className="icon" data-icon="check" />
                      </span>
                      <span className="title">{item.title}</span>
                      <span className="price">{item.price}</span>
                    </Checkbox>
                  ))}
                </div>
              </CheckboxGroup>
            )}
            <footer>
              <Button onPress={() => state.send({ type: 'close' })}>{i18n.cancel}</Button>
              <Button
                data-variant="primary"
                isDisabled={!state.choosing || selectedIds.length === 0}
                onPress={() => state.send({ type: 'next' })}
              >
                {i18n.choose.next}
              </Button>
            </footer>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rule">
              <RadioGroup
                onChange={(value) => set('direction', value as 'decrease' | 'increase')}
                value={values.direction}
              >
                <Label>{i18n.rule.direction}</Label>
                <div className="choices">
                  <Radio value="decrease">{i18n.rule.decrease}</Radio>
                  <Radio value="increase">{i18n.rule.increase}</Radio>
                </div>
              </RadioGroup>
              <NumberField
                formatOptions={{ style: 'unit', unit: 'percent' }}
                isInvalid={Boolean(ruleProblem)}
                minValue={0}
                onChange={(value) => set('percent', value)}
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
            </div>
            {ruleProblem && (
              <p className="problem" role="alert">
                {ruleProblem}
              </p>
            )}
            <footer>
              <Button onPress={() => state.send({ type: 'back' })}>{i18n.back}</Button>
              <Button
                data-variant="primary"
                isDisabled={Boolean(ruleProblem)}
                onPress={() => state.send({ type: 'next' })}
              >
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
                  <tr key={row.id}>
                    <th scope="row">{row.title}</th>
                    <td>{row.from}</td>
                    <td>
                      <strong>{row.to}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {limitText && (
              <p className="notice" data-tone="info" role="note">
                <span className="icon" data-icon="user" />
                {limitText}
              </p>
            )}
            <footer>
              <Button onPress={() => state.send({ type: 'back' })}>{i18n.back}</Button>
              <Button data-variant="primary" isDisabled={!canApply} onPress={() => state.send({ type: 'apply' })}>
                {applyText}
              </Button>
            </footer>
          </>
        )}

        {step >= 4 && (
          <>
            {state.summary ? (
              <div className="notice" data-tone={failedCount ? 'warn' : 'ok'} role="status">
                <span className="icon" data-icon={failedCount ? 'alert' : 'check'} />
                <p>{summaryText}</p>
              </div>
            ) : (
              <ProgressBar aria-label={i18n.progress.label} maxValue={progress.total} value={progress.value}>
                {({ percentage }) => (
                  <>
                    <span>{current ?? progress.text}</span>
                    <div className="bar">
                      <div className="fill" style={{ inlineSize: `${percentage}%` }} />
                    </div>
                  </>
                )}
              </ProgressBar>
            )}
            <ul aria-label={i18n.results} className="results">
              {results.map((result) => (
                <li data-failed={result.error !== null || undefined} key={result.id}>
                  <span className="icon" data-icon={result.error === null ? 'check' : 'alert'} />
                  <span className="title">{result.title}</span>
                  {result.error === null ? (
                    <span className="price">
                      {result.from} → <strong>{result.to}</strong>
                    </span>
                  ) : (
                    <span className="error">{result.error}</span>
                  )}
                </li>
              ))}
            </ul>
            {state.summary && (
              <footer>
                {failedCount > 0 && <Button onPress={() => state.send({ type: 'retryFailed' })}>{retryText}</Button>}
                <Button data-variant="primary" onPress={() => state.send({ type: 'close' })}>
                  {i18n.done}
                </Button>
              </footer>
            )}
          </>
        )}
      </Dialog>

      <ModalOverlay isOpen={state.confirmingLargeChange} onOpenChange={(open) => !open && state.send({ type: 'back' })}>
        <Modal data-size="small">
          <Dialog role="alertdialog">
            <Heading slot="title">{largeTitle}</Heading>
            <p>
              {largeText((chunks) => (
                <strong>{chunks}</strong>
              ))}
            </p>
            <footer>
              <Button autoFocus onPress={() => state.send({ type: 'back' })}>
                {i18n.large.back}
              </Button>
              <Button data-variant="danger" onPress={() => state.send({ type: 'confirm' })}>
                {i18n.large.confirm}
              </Button>
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Modal>
  </ModalOverlay>
);
