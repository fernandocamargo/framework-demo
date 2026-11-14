import { css } from 'framework';

import rules from '../default';

// The default page, with a row of its own for the page's label above the header.
export default css`
  ${rules}
  & {
    grid-template-rows: auto var(--header) 1fr;
  }
`;
