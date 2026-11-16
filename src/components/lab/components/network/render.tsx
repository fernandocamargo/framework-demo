export default ({ className, entries, label, none }) => (
  <ol aria-label={label} className={className}>
    {entries.length === 0 && <li>{none}</li>}
    {entries.map((entry) => (
      <li itemScope itemType="https://schema.org/Action" key={entry.id}>
        <link href={entry.status} itemProp="actionStatus" />
        <time itemProp="startTime">{entry.when}</time>
        <span itemProp="name">{entry.kind}</span>
        <span itemProp="description">{entry.text}</span>
      </li>
    ))}
  </ol>
);
