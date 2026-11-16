export default ({ account, handlers }) => (
  <li>
    <button onClick={handlers.fill} type="button">
      {account.label}
    </button>
  </li>
);
