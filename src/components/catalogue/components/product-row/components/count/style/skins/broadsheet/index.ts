import { css } from 'framework';

export default css`
  &[role='group'] {
    display: inline-flex;
    gap: 0.15rem;
    .react-aria-Button {
      inline-size: 1.5rem;
      min-block-size: 1.5rem;
      padding: 0;
      font-size: 0.9rem;
    }
    &[aria-busy='true'] .react-aria-Button {
      border-color: var(--accent);
      color: var(--accent);
    }
  }
`;
