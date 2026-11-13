import { Link } from 'react-aria-components'

export default ({ className, shown, href, icon, label, text }) =>
  shown &&
  (icon ? (
    <Link className={`react-aria-Link ${className}`} href={href} data-variant="icon" aria-label={label}>
      <span className="icon" data-icon="trash" />
    </Link>
  ) : (
    <Link className={`react-aria-Link ${className}`} href={href} data-variant="secondary">
      {text}
    </Link>
  ))
