// The button is for the product being edited, so it works only while the editor is open. It
// reads `route.edit` alone, so it renders when the editor opens or closes and for no other change
// of address; the lab around it reads none of the address.
export default ({ async: { sellOut }, i18n, route }) => ({ enabled: route.edit !== null, label: i18n.label, sellOut });

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'A product being edited': { route: { edit: 22 } },
  'Nothing being edited': {},
};
