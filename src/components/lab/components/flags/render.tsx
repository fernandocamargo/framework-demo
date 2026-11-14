import { Label, Radio, RadioGroup } from 'react-aria-components'

export default ({ className, intro, label, flags, sending }) => (
  <section className={className} aria-label={label} aria-busy={sending || undefined}>
    <p className="intro">{intro}</p>
    {flags.map((flag) =>
      flag.served === null ? (
        <div key={flag.name} className="flag">
          <p>
            {flag.title} <code>{flag.key}</code>
          </p>
          <p className="value">{flag.value}</p>
        </div>
      ) : (
        <RadioGroup key={flag.name} value={flag.served} onChange={flag.choose}>
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
)
