import { css } from 'framework';

export default css`
  & {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) 13rem 13rem;
    gap: 0.5rem 1.5rem;
    align-items: end;
  }
  & > select {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 2.3rem;
    padding: 0.3rem 0.15rem;
    border: 0;
    border-block-end: 1.5px solid var(--text);
    border-radius: 0;
    background: transparent;
    color: var(--text);
    font-family: var(--serif);
    cursor: pointer;
  }
  & > select:hover {
    border-block-end-color: var(--accent);
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
