// Deleting is a potential action on the product around it, as schema.org names one.
export default ({ className, href, label, shown }) =>
  shown && (
    <a aria-label={label} className={className} href={href} tabIndex={0}>
      <span itemProp="potentialAction" itemScope itemType="https://schema.org/DeleteAction">
        <span itemProp="name">{label}</span>
      </span>
    </a>
  );
