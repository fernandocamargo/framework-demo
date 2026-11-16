import { css } from 'framework';

export default css`
  & {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) 13rem 13rem;
    gap: 0.5rem;
  }
  & > select {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 2.4rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-s);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
  }
  & > select:hover {
    border-color: var(--muted);
  }
  @media (max-width: 44rem) {
    & {
      grid-template-columns: 1fr 1fr;
    }
    .react-aria-SearchField {
      grid-column: 1 / -1;
    }
  }
`;
