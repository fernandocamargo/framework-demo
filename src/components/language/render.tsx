// The language on screen, as schema.org names one, by its code.
export default ({ className, handlers, label, locale, options }) => (
  <div className={className} itemScope itemType="https://schema.org/Language">
    <meta content={locale} itemProp="alternateName" />
    <select aria-label={label} onChange={handlers.speakLanguage} value={locale}>
      {options.map((option) => (
        <option key={option.id} lang={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  </div>
);
