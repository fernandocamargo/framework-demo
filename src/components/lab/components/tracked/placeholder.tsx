// While the list's sheet or words load, when the tab first shows after the page's skin or language
// changed: the tab alone waits, and the lab and the page around it stay as they are.
export default ({ className, i18n }) => <ol aria-busy="true" aria-label={i18n.label} className={className} />;
