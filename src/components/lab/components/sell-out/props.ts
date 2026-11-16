export type Props = { id: null | number };
// The shell passes the ID only while its editor is open.

export default ({ i18n, id }) => ({ enabled: id !== null, label: i18n.label });

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'A product being edited': { props: { id: 22 } },
  'Nothing being edited': { props: { id: null } },
};
