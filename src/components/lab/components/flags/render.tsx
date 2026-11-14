import { Label, Radio, RadioGroup } from 'react-aria-components';

export default ({ className, flags, intro, label, sending }) => (
  <section aria-busy={sending || undefined} aria-label={label} className={className}>
    <p className="intro">{intro}</p>
    {flags.map((flag) =>
      flag.served === null ? (
        <div className="flag" key={flag.name}>
          <p>
            {flag.title} <code>{flag.key}</code>
          </p>
          <p className="value">{flag.value}</p>
        </div>
      ) : (
        <RadioGroup key={flag.name} onChange={flag.choose} value={flag.served}>
          <Label>
            {flag.title} <code>{flag.key}</code>
          </Label>
          <p className="value">{flag.value}</p>
          <div className="choices">
            {flag.ways.map((way) => (
              <Radio key={way.id} value={way.id}>
                {way.label}
              </Radio>
            ))}
          </div>
        </RadioGroup>
      ),
    )}
  </section>
);
