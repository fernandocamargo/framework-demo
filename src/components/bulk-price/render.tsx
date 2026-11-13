import { Button, Checkbox, CheckboxGroup, Dialog, Group, Heading, Input, Label, ListBox, ListBoxItem, Modal, ModalOverlay, NumberField, Popover, ProgressBar, Radio, RadioGroup, Select, SelectValue } from 'react-aria-components'

export default ({ className, state, set, values, step, steps, stepText, categories, items, selectedIds, selectionText, loadError, ruleProblem, ruleText, preview, progress, current, results, summaryText, failedCount }) => (
  <ModalOverlay isOpen isDismissable={!state.applying} isKeyboardDismissDisabled={state.applying} onOpenChange={(open) => !open && state.send({ type: 'close' })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="large">
      <Dialog>
        <header>
          <div>
            <Heading slot="title">Bulk price change</Heading>
            <p className="step-text">{stepText}</p>
          </div>
          <Button data-variant="icon" aria-label="Close" isDisabled={state.applying} onPress={() => state.send({ type: 'close' })}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>
        <ol className="steps" aria-hidden="true">
          {steps.map((step) => (
            <li key={step.label} data-current={step.current || undefined} data-done={step.done || undefined}>
              {step.label}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <>
            <Select
              selectedKey={values.category}
              onSelectionChange={(key) => state.send({ type: 'categoryChanged', category: String(key) })}
            >
              <Label>Category</Label>
              <Button>
                <SelectValue />
                <span className="icon" data-icon="chevron" />
              </Button>
              <Popover>
                <ListBox items={categories}>{(category) => <ListBoxItem id={category.slug}>{category.name}</ListBoxItem>}</ListBox>
              </Popover>
            </Select>
            {state.loadingProducts ? (
              <div className="skeleton" style={{ blockSize: '12rem' }} aria-busy="true" aria-label="Reading the products" />
            ) : loadError ? (
              <div className="notice" data-tone="danger" role="alert">
                <span className="icon" data-icon="alert" />
                <div>
                  <p>The products could not be read: {loadError}</p>
                  <div className="actions">
                    <Button onPress={() => state.send({ type: 'retry' })}>Try again</Button>
                  </div>
                </div>
              </div>
            ) : (
              <CheckboxGroup value={selectedIds} onChange={(ids) => set('selected', ids.map(Number))}>
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
              <Button onPress={() => state.send({ type: 'close' })}>Cancel</Button>
              <Button data-variant="primary" isDisabled={!state.choosing || selectedIds.length === 0} onPress={() => state.send({ type: 'next' })}>
                Next: the rule
              </Button>
            </footer>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rule">
              <RadioGroup value={values.direction} onChange={(value) => set('direction', value as 'decrease' | 'increase')}>
                <Label>Direction</Label>
                <div className="choices">
                  <Radio value="decrease">Decrease</Radio>
                  <Radio value="increase">Increase</Radio>
                </div>
              </RadioGroup>
              <NumberField value={values.percent} onChange={(value) => set('percent', value)} minValue={0} step={1} formatOptions={{ style: 'unit', unit: 'percent' }} isInvalid={Boolean(ruleProblem)}>
                <Label>By</Label>
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
              <Button onPress={() => state.send({ type: 'back' })}>Back</Button>
              <Button data-variant="primary" isDisabled={Boolean(ruleProblem)} onPress={() => state.send({ type: 'next' })}>
                Next: preview
              </Button>
            </footer>
          </>
        )}

        {step === 3 && (
          <>
            <p>
              <strong>{ruleText}</strong>, for {selectionText.replace(' selected', '')}.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Now</th>
                  <th scope="col">After</th>
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
            <footer>
              <Button onPress={() => state.send({ type: 'back' })}>Back</Button>
              <Button data-variant="primary" onPress={() => state.send({ type: 'apply' })}>
                Apply to {preview.length}
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
              <ProgressBar value={progress.value} maxValue={progress.total} aria-label="Prices saved">
                {({ percentage }) => (
                  <>
                    <span>{current ? `Saving ${current}…` : progress.text}</span>
                    <div className="bar">
                      <div className="fill" style={{ inlineSize: `${percentage}%` }} />
                    </div>
                  </>
                )}
              </ProgressBar>
            )}
            <ul className="results" aria-label="Results">
              {results.map((result) => (
                <li key={result.id} data-failed={result.error !== null || undefined}>
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
                {failedCount > 0 && <Button onPress={() => state.send({ type: 'retryFailed' })}>Try the {failedCount} failed again</Button>}
                <Button data-variant="primary" onPress={() => state.send({ type: 'close' })}>
                  Done
                </Button>
              </footer>
            )}
          </>
        )}
      </Dialog>
    </Modal>
  </ModalOverlay>
)
