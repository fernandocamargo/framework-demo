import { css } from 'framework';

import rules from '../default';

// The default page, with a row of its own for the page's label above the header, and a header
// whose labelled pieces wrap.
export default css`
  ${rules}
  & {
    grid-template-rows: auto auto 1fr;
  }
  /* The header's pieces carry labels too: they wrap rather than crowd one line. */
  > header {
    flex-wrap: wrap;
    min-block-size: var(--header);
    padding-block: 0.35rem;
  }
`;
