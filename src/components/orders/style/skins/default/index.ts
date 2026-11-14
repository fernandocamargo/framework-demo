import { css } from 'framework';

// The orders page: its heading, the map and the ledger one under the other. A note for those who
// may not read orders is set apart, as a notice.
export default css`
  & {
    display: grid;
    gap: 1.25rem;
  }
  h2 {
    font-size: 1.5rem;
    letter-spacing: -0.02em;
  }
  & > p[role='note'] {
    display: grid;
    justify-items: start;
    gap: 0.5rem;
    padding: 2rem 1rem;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    color: var(--muted);
  }
`;
