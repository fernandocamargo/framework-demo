// While the orders are read: the map's frame, with its grid empty and busy.
export default ({ className, i18n }) => (
  <figure aria-busy="true" className={className}>
    <figcaption>{i18n.loading}</figcaption>
    <ol aria-hidden="true" />
  </figure>
);
