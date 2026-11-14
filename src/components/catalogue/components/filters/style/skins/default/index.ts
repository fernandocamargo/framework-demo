import { css } from 'framework';

export default css`
  & {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) 13rem 13rem;
    gap: 0.5rem;
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
