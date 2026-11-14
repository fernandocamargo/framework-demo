import { css } from 'framework';

export default css`
  & {
    display: grid;
    gap: 1rem;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 0.75rem;
    h2 {
      font-size: 1.5rem;
      letter-spacing: -0.02em;
    }
  }
  .summary {
    color: var(--muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .rows {
    display: grid;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  .rows[aria-hidden] {
    gap: 1px;
    border: 0;
    background: none;
    gap: 0.5rem;
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    color: var(--muted);
  }
  .paging {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
`;
