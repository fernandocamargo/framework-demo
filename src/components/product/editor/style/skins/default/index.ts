import { css } from 'framework';

export default css`
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
  }
  .wide {
    grid-column: 1 / -1;
  }
  @media (max-width: 30rem) {
    .fields {
      grid-template-columns: 1fr;
    }
  }
`;
