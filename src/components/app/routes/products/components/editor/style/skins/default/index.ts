import { css } from 'framework';

export default css`
  fieldset,
  [aria-busy='true'] {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
  }
  /* The title and the description take the whole width. */
  .react-aria-TextField:has([name='title'], [name='description']) {
    grid-column: 1 / -1;
  }
  /* While the product is read: its fields, as shapes. */
  [aria-busy='true'] > div {
    block-size: 2.4rem;
    border-radius: var(--radius-s);
    background: var(--placeholder);
    animation: shimmer 1.4s linear infinite;
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
