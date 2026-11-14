import { Link } from 'react-aria-components';

// Deleting is a potential action on the product around it, as schema.org names one.
export default ({ className, href, label, shown }) =>
  shown && (
    <Link className={`react-aria-Link ${className}`} href={href}>
      <span itemProp="potentialAction" itemScope itemType="https://schema.org/DeleteAction">
        <span itemProp="name">{label}</span>
      </span>
    </Link>
  );
