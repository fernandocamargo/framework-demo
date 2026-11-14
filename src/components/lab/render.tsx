import { createPortal } from 'react-dom'
import { Button, Label, Radio, RadioGroup, Slider, SliderOutput, SliderThumb, SliderTrack, Switch, Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import Flags from './components/flags'

export default ({ className, i18n, open, send, change, expireToken, breakRefresh, forgetChanges, sellOut, faults, toggleLabel, latency, latencyText, failurePercent, failureText, force, offline, tokenMinutes, minutes, canSellOut, network, tracked }) => (
  <div className={className}>
    <Button aria-label={toggleLabel} aria-expanded={open} aria-controls="network-lab" data-active={faults > 0 || undefined} onPress={() => send({ type: 'toggle' })}>
      <span className="icon" data-icon="signal" />
      <span className="text">{i18n.title}</span>
      {faults > 0 && <span className="count">{faults}</span>}
    </Button>

    {/* The panel goes to the end of the page, outside the header (which is its own stacking
        context), and is marked top layer: it stays above the dialogs, and usable while one is open. */}
    {open &&
      createPortal(
      <aside id="network-lab" className={`${className} panel`} aria-label={i18n.title} data-react-aria-top-layer="true">
        <header>
          <h2>{i18n.title}</h2>
          <Button data-variant="icon" aria-label={i18n.close} onPress={() => send({ type: 'toggle' })}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>
        <p className="intro">{i18n.intro}</p>

        <div className="controls">
          <Slider key={`latency-${latency}`} defaultValue={latency} minValue={0} maxValue={3000} step={250} onChangeEnd={(value) => change({ latency: value as number })}>
            <Label>{i18n.latency.label}</Label>
            <SliderOutput>{({ state }) => latencyText(state.getThumbValue(0))}</SliderOutput>
            <SliderTrack>
              <SliderThumb />
            </SliderTrack>
          </Slider>
          <Slider key={`failures-${failurePercent}`} defaultValue={failurePercent} minValue={0} maxValue={100} step={10} onChangeEnd={(value) => change({ failureRate: (value as number) / 100 })}>
            <Label>{i18n.failures.label}</Label>
            <SliderOutput>{({ state }) => failureText(state.getThumbValue(0))}</SliderOutput>
            <SliderTrack>
              <SliderThumb />
            </SliderTrack>
          </Slider>
          <RadioGroup value={force} onChange={(value) => change({ force: Number(value) as 0 | 429 | 500 })}>
            <Label>{i18n.force.label}</Label>
            <div className="choices">
              <Radio value="0">{i18n.force.ok}</Radio>
              <Radio value="500">500</Radio>
              <Radio value="429">429</Radio>
            </div>
          </RadioGroup>
          <RadioGroup value={tokenMinutes} onChange={(value) => change({ tokenMinutes: Number(value) })}>
            <Label>{i18n.token.label}</Label>
            <div className="choices">
              {minutes.map((choice) => (
                <Radio key={choice.value} value={choice.value}>
                  {choice.label}
                </Radio>
              ))}
            </div>
          </RadioGroup>
          <Switch isSelected={offline} onChange={(selected) => change({ offline: selected })}>
            <span className="track" />
            {i18n.offline}
          </Switch>
        </div>

        <div className="buttons">
          <Button onPress={() => expireToken()}>{i18n.actions.expire}</Button>
          <Button onPress={() => breakRefresh()}>{i18n.actions.revoke}</Button>
          <Button isDisabled={!canSellOut} onPress={() => sellOut()}>
            {i18n.actions.sellOut}
          </Button>
          <Button onPress={() => forgetChanges()}>{i18n.actions.forget}</Button>
        </div>

        <Tabs>
          <TabList aria-label={i18n.tabs.label}>
            <Tab id="network">{i18n.tabs.network}</Tab>
            <Tab id="tracked">{i18n.tabs.tracked}</Tab>
            <Tab id="flags">{i18n.tabs.flags}</Tab>
          </TabList>
          <TabPanel id="network">
            <ol className="log" aria-label={i18n.network.label}>
              {network.length === 0 && <li className="none">{i18n.network.none}</li>}
              {network.map((entry) => (
                <li key={entry.id}>
                  <time>{entry.when}</time>
                  <span className="badge" data-tone={entry.tone}>
                    {entry.kind}
                  </span>
                  <span>{entry.text}</span>
                </li>
              ))}
            </ol>
          </TabPanel>
          <TabPanel id="tracked">
            <ol className="log" aria-label={i18n.tracked.label}>
              {tracked.length === 0 && <li className="none">{i18n.tracked.none}</li>}
              {tracked.map((entry) => (
                <li key={entry.id} data-kind={entry.type}>
                  <time>{entry.when}</time>
                  <span className="badge" data-tone={entry.tone}>
                    {entry.kind}
                  </span>
                  <span>
                    {entry.text && <code>{entry.text}</code>} <small>{entry.where}</small>
                  </span>
                </li>
              ))}
            </ol>
          </TabPanel>
          <TabPanel id="flags">
            <Flags />
          </TabPanel>
        </Tabs>
      </aside>,
        document.body,
      )}
  </div>
)
