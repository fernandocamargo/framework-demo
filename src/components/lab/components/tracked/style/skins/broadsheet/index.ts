import { css } from 'framework';

export default css`
  display: grid;
  align-content: start;
  overflow: auto;
  font-family: var(--mono);
  font-size: 0.74rem;
  li {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: baseline;
    gap: 0.5rem;
    padding-block: 0.25rem;
    border-block-end: 1px dotted var(--text);
    overflow-wrap: anywhere;
  }
  li:not([itemscope]) {
    display: block;
    border: 0;
    font-family: var(--serif);
    font-style: italic;
  }
  time {
    color: var(--muted);
  }
  small {
    color: var(--muted);
  }
  [itemprop='name'] {
    font-weight: 700;
    text-transform: uppercase;
  }
  li:has(> [itemprop='actionStatus'][href='https://schema.org/FailedActionStatus']) [itemprop='name'] {
    color: var(--accent);
  }
  li:has(> [itemprop='actionStatus'][href='https://schema.org/ActiveActionStatus']) [itemprop='name'] {
    color: var(--warn);
  }
  li:has(> [itemprop='agent']) {
    margin-block-start: 0.4rem;
    border-block-start: 2px solid var(--text);
  }
`;
