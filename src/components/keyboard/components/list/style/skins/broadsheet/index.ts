import { css } from 'framework';

// The keys as an index: each key, dotted leaders, and what it does.
export default css`
  & header + p {
    margin-block-end: 1rem;
    font-style: italic;
  }
  & section + section {
    margin-block-start: 1.25rem;
  }
  & h3 {
    margin-block-end: 0.4rem;
    padding-block-end: 0.2rem;
    border-block-end: 1px solid var(--text);
    font-size: 0.8rem;
    font-weight: 400;
  }
  & dl {
    display: grid;
    gap: 0.3rem;
  }
  & dl > div {
    display: grid;
    grid-template-columns: 7rem 1fr;
    align-items: baseline;
    gap: 0.75rem;
  }
  & dl > div:not(:has([itemprop='actionStatus'])) {
    color: var(--muted);
    text-decoration: line-through;
  }
  & dt {
    display: flex;
    gap: 0.25rem;
  }
  & dd {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    &::before {
      content: '';
      order: 1;
      flex: 1;
      border-block-end: 1px dotted var(--muted);
    }
    small {
      order: 2;
      font-style: italic;
    }
  }
  & kbd {
    min-inline-size: 1.6rem;
    padding: 0.05rem 0.4rem;
    border: 1.5px solid var(--text);
    box-shadow: 2px 2px 0 var(--text);
    font-size: 0.8rem;
    font-weight: 700;
    text-align: center;
  }
`;
