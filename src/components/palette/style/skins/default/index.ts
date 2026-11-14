import { css } from 'framework';

// The button is its key alone, as the keyboard's is.
export default css`
  & {
    padding: 0.1rem 0.5rem;
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
    font-size: 0.8rem;
    font-weight: 600;
  }
`;
