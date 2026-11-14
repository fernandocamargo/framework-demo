export default ({ className, i18n }) => (
  <div aria-busy="true" className={className}>
    <header>
      <hgroup>
        <h1>{i18n.brand}</h1>
      </hgroup>
    </header>
    <main aria-label={i18n.loading} />
  </div>
);
