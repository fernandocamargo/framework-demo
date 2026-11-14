import { css } from 'framework';

export default css`
  & {
    display: grid;
    gap: 0.6rem;
    padding-block-start: 1rem;
    border-block-start: 1px solid var(--border);
  }
  h3 {
    font-size: 0.95rem;
  }
  ul {
    display: grid;
    gap: 0.75rem;
  }
  .stars .icon {
    color: var(--border-strong);
    &[data-lit] {
      color: var(--warn);
    }
  }
  .by {
    color: var(--muted);
    font-size: 0.87rem;
  }
`;
