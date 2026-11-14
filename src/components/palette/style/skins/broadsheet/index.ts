import { css } from 'framework';

// The button is its key, boxed as the keys of an index are.
export default css`
  & {
    padding: 0;
    border-color: transparent;
    background: transparent;
  }
  & kbd {
    padding: 0 0.3rem;
    border: 1px solid currentColor;
    font-weight: 700;
  }
`;
