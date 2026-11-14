import { css } from 'framework';

export default css`
  & header + p {
    color: var(--muted);
    margin-block-end: 1rem;
  }
  & section + section {
    margin-block-start: 1rem;
  }
  & h3 {
    font-size: 0.85rem;
    font-weight: 500;
    margin-block-end: 0.4rem;
  }
  & h3 code {
    color: var(--muted);
  }
  & dl {
    display: grid;
    gap: 0.35rem;
    margin: 0;
  }
  & dl > div {
    display: grid;
    grid-template-columns: 7rem 1fr;
    align-items: center;
    gap: 0.75rem;
  }
  /* A key that does nothing now. */
  & dl > div:not(:has([itemprop='actionStatus'])) {
    color: var(--muted);
  }
  & dd small {
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  & dt {
    display: flex;
    gap: 0.25rem;
  }
  & dd {
    margin: 0;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  & kbd {
    min-inline-size: 1.6rem;
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--border-strong);
    border-block-end-width: 2px;
    border-radius: 0.3rem;
    background: var(--surface-2);
    font: inherit;
    font-size: 0.85rem;
    text-align: center;
  }
`;
