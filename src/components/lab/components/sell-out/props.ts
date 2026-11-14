// The button is for the product being edited, so it works only while the editor is open. It
// reads `route.edit` alone, so it renders when the editor opens or closes and for no other change
// of address; the lab around it reads none of the address.
export default ({ i18n, route, async: { sellOut } }) => ({ label: i18n.label, enabled: route.edit !== null, sellOut })

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'Nothing being edited': {},
  'A product being edited': { route: { edit: 22 } },
}
