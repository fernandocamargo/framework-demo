import { Link } from 'react-aria-components';

export default ({ className, href, icon, label, shown, text }) =>
  shown &&
  (icon ? (
    <Link aria-label={label} className={`react-aria-Link ${className}`} data-variant="icon" href={href}>
      <span className="icon" data-icon="trash" />
    </Link>
  ) : (
    <Link className={`react-aria-Link ${className}`} data-variant="secondary" href={href}>
      {text}
    </Link>
  ));
