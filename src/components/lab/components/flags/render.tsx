import { Label, Radio, RadioGroup } from 'react-aria-components';

// Each flag is a named value, as schema.org names one: its title, its key and how it is served.
export default ({ className, flags, intro, label, sending }) => (
  <section aria-busy={sending || undefined} aria-label={label} className={className}>
    <p>{intro}</p>
    {flags.map((flag) =>
      flag.served === null ? (
        <div itemScope itemType="https://schema.org/PropertyValue" key={flag.name}>
          <p>
            <span itemProp="name">{flag.title}</span> <code itemProp="propertyID">{flag.key}</code>
          </p>
          <p itemProp="value">{flag.value}</p>
        </div>
      ) : (
        <div itemScope itemType="https://schema.org/PropertyValue" key={flag.name}>
          <RadioGroup onChange={flag.choose} value={flag.served}>
            <Label>
              <span itemProp="name">{flag.title}</span> <code itemProp="propertyID">{flag.key}</code>
            </Label>
            <p itemProp="value">{flag.value}</p>
            {flag.ways.map((way) => (
              <Radio key={way.id} value={way.id}>
                {way.label}
              </Radio>
            ))}
          </RadioGroup>
        </div>
      ),
    )}
  </section>
);
