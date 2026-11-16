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
import Network from './components/network';
import SellOut from './components/sell-out';
import Tracked from './components/tracked';

// The lab is a tool of its own, as schema.org names a piece of software; each entry of its logs is
// an action, with what became of it.
export default ({
  className,
  failurePercent,
  failureText,
  faults,
  force,
  handlers,
  i18n,
  latency,
  latencyText,
  minutes,
  offline,
  open,
  toggleLabel,
  tokenMinutes,
}) => (
  <div className={className}>
    <Button aria-controls="network-lab" aria-expanded={open} aria-label={toggleLabel} onPress={handlers.toggleLab}>
      <span>{i18n.title}</span>
      {faults > 0 && <data value={faults}>{faults}</data>}
    </Button>

    {/* The panel goes to the end of the page, outside the header (which is its own stacking
        context), and is marked top layer: it stays above the dialogs, and usable while one is open. */}
    {open &&
      createPortal(
        <aside
          aria-label={i18n.title}
          className={className}
          data-react-aria-top-layer="true"
          id="network-lab"
          itemScope
          itemType="https://schema.org/SoftwareApplication"
        >
          <header>
            <h2 itemProp="name">{i18n.title}</h2>
            <Button onPress={handlers.toggleLab} slot="close">
              {i18n.close}
            </Button>
          </header>
          <p itemProp="description">{i18n.intro}</p>
          <fieldset>
            <Slider defaultValue={latency} maxValue={3000} minValue={0} onChangeEnd={handlers.setLatency} step={250}>
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
              onChangeEnd={handlers.setFailureRate}
              step={10}
            >
              <Label>{i18n.failures.label}</Label>
              <SliderOutput>{({ state }) => failureText({ percent: state.getThumbValue(0) })}</SliderOutput>
              <SliderTrack>
                <SliderThumb />
              </SliderTrack>
            </Slider>
            <RadioGroup onChange={handlers.forceStatus} value={force}>
              <Label>{i18n.force.label}</Label>
              <Radio value="0">{i18n.force.ok}</Radio>
              <Radio value="500">500</Radio>
              <Radio value="429">429</Radio>
            </RadioGroup>
            <RadioGroup onChange={handlers.setTokenMinutes} value={tokenMinutes}>
              <Label>{i18n.token.label}</Label>
              {minutes.map((choice) => (
                <Radio key={choice.value} value={choice.value}>
                  {choice.label}
                </Radio>
              ))}
            </RadioGroup>
            <Switch isSelected={offline} onChange={handlers.setOffline}>
              {i18n.offline}
            </Switch>
          </fieldset>
          <menu>
            <li>
              <Button onPress={handlers.expireToken}>{i18n.actions.expire}</Button>
            </li>
            <li>
              <Button onPress={handlers.breakRefresh}>{i18n.actions.revoke}</Button>
            </li>
            <li>
              <SellOut />
            </li>
            <li>
              <Button onPress={handlers.forgetChanges}>{i18n.actions.forget}</Button>
            </li>
          </menu>
          {/* TabPanel unmounts the hidden child, stopping that list's chart and timer. */}
          <Tabs>
            <TabList aria-label={i18n.tabs.label}>
              <Tab id="network">{i18n.tabs.network}</Tab>
              <Tab id="tracked">{i18n.tabs.tracked}</Tab>
              <Tab id="flags">{i18n.tabs.flags}</Tab>
            </TabList>
            <TabPanel id="network">
              <Network />
            </TabPanel>
            <TabPanel id="tracked">
              <Tracked />
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
