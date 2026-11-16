export type Props = { id: number; stock: number; title: string };

export default ({ className, i18n, status, stock, title }) => ({
  className,
  disabled: stock === 0,
  label: i18n.label({ title }),
  less: i18n.less,
  more: i18n.more,
  sending: status.setStock.pending,
});

export const examples = {
  'In stock': { props: { id: 22, stock: 58, title: 'Arc Floor Lamp' } },
  'Out of stock': { props: { id: 23, stock: 0, title: 'Desk Lamp' } },
};
