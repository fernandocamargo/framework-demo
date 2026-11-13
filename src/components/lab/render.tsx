import { createPortal } from 'react-dom'
import { Button, Label, Radio, RadioGroup, Slider, SliderOutput, SliderThumb, SliderTrack, Switch, Tab, TabList, TabPanel, Tabs } from 'react-aria-components'

export default ({ className, open, send, change, expireToken, breakRefresh, forgetChanges, sellOut, faults, toggleLabel, latency, failurePercent, force, offline, tokenMinutes, canSellOut, network, tracked }) => (
  <div className={className}>
    <Button aria-label={toggleLabel} aria-expanded={open} aria-controls="network-lab" data-active={faults > 0 || undefined} onPress={() => send({ type: 'toggle' })}>
      <span className="icon" data-icon="signal" />
      <span className="text">Network lab</span>
      {faults > 0 && <span className="count">{faults}</span>}
    </Button>

    {/* The panel goes to the end of the page, outside the header (which is its own stacking
        context), and is marked top layer: it stays above the dialogs, and usable while one is open. */}
    {open &&
      createPortal(
      <aside id="network-lab" className={`${className} panel`} aria-label="Network lab" data-react-aria-top-layer="true">
        <header>
          <h2>Network lab</h2>
          <Button data-variant="icon" aria-label="Close the network lab" onPress={() => send({ type: 'toggle' })}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>
        <p className="intro">These change the API client's settings while the app runs. Nothing else in the app knows.</p>

        <div className="controls">
          <Slider key={`latency-${latency}`} defaultValue={latency} minValue={0} maxValue={3000} step={250} onChangeEnd={(value) => change({ latency: value as number })}>
            <Label>Latency</Label>
            <SliderOutput>{({ state }) => `${state.getThumbValue(0)} ms`}</SliderOutput>
            <SliderTrack>
              <SliderThumb />
            </SliderTrack>
          </Slider>
          <Slider key={`failures-${failurePercent}`} defaultValue={failurePercent} minValue={0} maxValue={100} step={10} onChangeEnd={(value) => change({ failureRate: (value as number) / 100 })}>
            <Label>Requests that fail</Label>
            <SliderOutput>{({ state }) => `${state.getThumbValue(0)}%`}</SliderOutput>
            <SliderTrack>
              <SliderThumb />
            </SliderTrack>
          </Slider>
          <RadioGroup value={force} onChange={(value) => change({ force: Number(value) as 0 | 429 | 500 })}>
            <Label>Every request answers</Label>
            <div className="choices">
              <Radio value="0">As it should</Radio>
              <Radio value="500">500</Radio>
              <Radio value="429">429</Radio>
            </div>
          </RadioGroup>
          <RadioGroup value={tokenMinutes} onChange={(value) => change({ tokenMinutes: Number(value) })}>
            <Label>Access token lifetime, from the next sign-in or refresh</Label>
            <div className="choices">
              <Radio value="1">1 min</Radio>
              <Radio value="5">5 min</Radio>
              <Radio value="30">30 min</Radio>
            </div>
          </RadioGroup>
          <Switch isSelected={offline} onChange={(selected) => change({ offline: selected })}>
            <span className="track" />
            Offline
          </Switch>
        </div>

        <div className="buttons">
          <Button onPress={() => expireToken()}>Expire the access token</Button>
          <Button onPress={() => breakRefresh()}>Revoke the refresh token</Button>
          <Button isDisabled={!canSellOut} onPress={() => sellOut()}>
            Sell out the product being edited
          </Button>
          <Button onPress={() => forgetChanges()}>Forget local changes</Button>
        </div>

        <Tabs>
          <TabList aria-label="Activity">
            <Tab id="network">API client</Tab>
            <Tab id="tracked">Interactions and failures</Tab>
          </TabList>
          <TabPanel id="network">
            <ol className="log" aria-label="The API client's latest requests">
              {network.length === 0 && <li className="none">No request yet.</li>}
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
            <ol className="log" aria-label="The latest interactions and failures">
              {tracked.length === 0 && <li className="none">Nothing yet. Every handler in a render is tracked with the place it was written.</li>}
              {tracked.map((entry) => (
                <li key={`${entry.kind}-${entry.id}`}>
                  <time>{entry.when}</time>
                  <span className="badge" data-tone={entry.tone}>
                    {entry.kind}
                  </span>
                  <span>
                    {entry.text} <small>{entry.where}</small>
                  </span>
                </li>
              ))}
            </ol>
          </TabPanel>
        </Tabs>
      </aside>,
        document.body,
      )}
  </div>
)
