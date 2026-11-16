import { css } from 'framework';

export default css`
  &[role='group'] {
    display: inline-flex;
    .react-aria-Button {
      inline-size: 1.6rem;
      min-block-size: 1.6rem;
      padding: 0;
      border-color: transparent;
      background: transparent;
      color: var(--muted);
      font-weight: 600;
      &[data-hovered] {
        background: var(--surface-2);
        color: var(--text);
      }
    }
    /* The count shows at once; the buttons say a write is on its way. */
    &[aria-busy='true'] .react-aria-Button {
      color: var(--accent);
    }
  }
`;
