import { css } from 'framework';

// The button is its key alone.
export default css`
  & {
    inline-size: 2.4rem;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--muted);
    &[data-hovered] {
      background: var(--surface-2);
      color: var(--text);
    }
  }
  & kbd {
    font: inherit;
    font-weight: 600;
  }
`;
