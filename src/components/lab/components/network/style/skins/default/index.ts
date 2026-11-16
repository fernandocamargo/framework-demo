import { css } from 'framework';

export default css`
  display: grid;
  gap: 0.35rem;
  align-content: start;
  overflow: auto;
  font-size: 0.82rem;
  li {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: baseline;
    gap: 0.4rem;
    overflow-wrap: anywhere;
  }
  /* Nothing yet. */
  li:not([itemscope]) {
    display: block;
    color: var(--muted);
  }
  time {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  small {
    color: var(--muted);
  }
  code {
    font-size: 0.78rem;
    margin-inline-end: 0.3rem;
  }
  /* What each entry is, coloured by what became of it. */
  [itemprop='name'] {
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  li:has(> [itemprop='actionStatus'][href='https://schema.org/CompletedActionStatus']) [itemprop='name'] {
    background: var(--ok-soft);
    color: var(--ok);
  }
  li:has(> [itemprop='actionStatus'][href='https://schema.org/FailedActionStatus']) [itemprop='name'] {
    background: var(--danger-soft);
    color: var(--danger);
  }
  li:has(> [itemprop='actionStatus'][href='https://schema.org/ActiveActionStatus']) [itemprop='name'] {
    background: var(--warn-soft);
    color: var(--warn);
  }
  /* What the person did starts a group: the reads and the work it caused follow. */
  li:has(> [itemprop='agent']) {
    padding-block-start: 0.35rem;
    border-block-start: 1px solid var(--border);
  }
`;
