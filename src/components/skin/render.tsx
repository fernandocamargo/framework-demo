// The select keeps its own choice: the page's skin changes around it, and nothing here follows it.
export default ({ className, handlers, label, options, skin }) => (
  <div className={className}>
    <select aria-label={label} defaultValue={skin} onChange={handlers.wearSkin}>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  </div>
);
