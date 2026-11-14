import { css } from 'framework';

// The editor as a form on paper: fields as rules to write on, two to a line.
export default css`
  fieldset,
  [aria-busy='true'] {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.1rem 1.5rem;
  }
  .react-aria-TextField:has([name='title'], [name='description']) {
    grid-column: 1 / -1;
  }
  .react-aria-TextField:has([name='title']) .react-aria-Input {
    font-size: 1.4rem;
    font-weight: 700;
  }
  .react-aria-TextArea {
    border: 1.5px solid var(--text);
    padding: 0.5rem;
    font-style: italic;
  }
  [aria-busy='true'] > div {
    block-size: 2.4rem;
    border: 1px solid var(--text);
    background: var(--placeholder);
    animation: shimmer 2.4s linear infinite;
    &:nth-child(-n + 2) {
      grid-column: 1 / -1;
    }
    &:nth-child(2) {
      block-size: 5.5rem;
    }
  }
  @media (max-width: 30rem) {
    fieldset,
    [aria-busy='true'] {
      grid-template-columns: 1fr;
    }
  }
`;
