import {
  Button,
  Label,
  Radio,
  RadioGroup,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from 'react-aria-components';
import { createPortal } from 'react-dom';

import Flags from './components/flags';
import SellOut from './components/sell-out';

export default ({
  breakRefresh,
  change,
  className,
  expireToken,
  failurePercent,
  failureText,
  faults,
  force,
  forgetChanges,
  i18n,
  latency,
  latencyText,
  minutes,
  network,
  offline,
  open,
  send,
  toggleLabel,
  tokenMinutes,
  tracked,
}) => (
  <div className={className}>
    <Button
      aria-controls="network-lab"
      aria-expanded={open}
      aria-label={toggleLabel}
      data-active={faults > 0 || undefined}
      onPress={() => send({ type: 'toggle' })}
    >
      <span className="icon" data-icon="signal" />
      <span className="text">{i18n.title}</span>
      {faults > 0 && <span className="count">{faults}</span>}
    </Button>

    {/* The panel goes to the end of the page, outside the header (which is its own stacking
        context), and is marked top layer: it stays above the dialogs, and usable while one is open. */}
    {open &&
      createPortal(
        <aside
          aria-label={i18n.title}
          className={`${className} panel`}
          data-react-aria-top-layer="true"
          id="network-lab"
        >
          <header>
            <h2>{i18n.title}</h2>
            <Button aria-label={i18n.close} data-variant="icon" onPress={() => send({ type: 'toggle' })}>
              <span className="icon" data-icon="close" />
            </Button>
          </header>
          <p className="intro">{i18n.intro}</p>

          <div className="controls">
            <Slider
              defaultValue={latency}
              maxValue={3000}
              minValue={0}
              onChangeEnd={(value) => change({ latency: value as number })}
              step={250}
            >
              <Label>{i18n.latency.label}</Label>
              <SliderOutput>{({ state }) => latencyText({ ms: state.getThumbValue(0) })}</SliderOutput>
              <SliderTrack>
                <SliderThumb />
              </SliderTrack>
            </Slider>
            <Slider
              defaultValue={failurePercent}
              maxValue={100}
              minValue={0}
              onChangeEnd={(value) => change({ failureRate: (value as number) / 100 })}
              step={10}
            >
              <Label>{i18n.failures.label}</Label>
              <SliderOutput>{({ state }) => failureText({ percent: state.getThumbValue(0) })}</SliderOutput>
              <SliderTrack>
                <SliderThumb />
              </SliderTrack>
            </Slider>
            <RadioGroup onChange={(value) => change({ force: Number(value) as 0 | 429 | 500 })} value={force}>
              <Label>{i18n.force.label}</Label>
              <div className="choices">
                <Radio value="0">{i18n.force.ok}</Radio>
                <Radio value="500">500</Radio>
                <Radio value="429">429</Radio>
              </div>
            </RadioGroup>
            <RadioGroup onChange={(value) => change({ tokenMinutes: Number(value) })} value={tokenMinutes}>
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
            <SellOut />
            <Button onPress={() => forgetChanges()}>{i18n.actions.forget}</Button>
          </div>

          <Tabs>
            <TabList aria-label={i18n.tabs.label}>
              <Tab id="network">{i18n.tabs.network}</Tab>
              <Tab id="tracked">{i18n.tabs.tracked}</Tab>
              <Tab id="flags">{i18n.tabs.flags}</Tab>
            </TabList>
            <TabPanel id="network">
              <ol aria-label={i18n.network.label} className="log">
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
              <ol aria-label={i18n.tracked.label} className="log">
                {tracked.length === 0 && <li className="none">{i18n.tracked.none}</li>}
                {tracked.map((entry) => (
                  <li data-kind={entry.type} key={entry.id}>
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
);
