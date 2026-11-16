// The button is for the product being edited, so it works only while the editor is open. It
// reads the route's pattern, so it renders when the editor opens or closes and for no other change
// of address; the lab around it reads none of the address.
export default ({ i18n, route }) => ({ enabled: route.pattern === '/products/:id/edit', label: i18n.label });

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'A product being edited': { route: { params: { id: 22 }, pattern: '/products/:id/edit' } },
  'Nothing being edited': {},
};
