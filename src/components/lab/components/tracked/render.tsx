export default ({ className, entries, label, none }) => (
  <ol aria-label={label} className={className}>
    {entries.length === 0 && <li>{none}</li>}
    {entries.map((entry) => (
      <li itemScope itemType="https://schema.org/Action" key={entry.id}>
        <link href={entry.status} itemProp="actionStatus" />
        {entry.byPerson && <span hidden itemProp="agent" itemScope itemType="https://schema.org/Person" />}
        <time itemProp="startTime">{entry.when}</time>
        <span itemProp="name">{entry.kind}</span>
        <span itemProp="description">
          {entry.text && <code>{entry.text}</code>} <small>{entry.where}</small>
        </span>
      </li>
    ))}
  </ol>
);
