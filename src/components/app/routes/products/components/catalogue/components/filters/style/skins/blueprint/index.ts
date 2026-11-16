import { css } from 'framework';

import rules from '../default';

// The default bar, wrapping instead of sitting in a grid: the search's label and its hidden query
// take a place of their own beside the fields.
export default css`
  ${rules}
  & {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }
  .react-aria-SearchField {
    flex: 1 1 18rem;
  }
  .react-aria-Select {
    flex: 0 1 13rem;
  }
`;
