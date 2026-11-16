import { css } from 'framework';

import rules from '../default';

// The default row, with its pieces wrapping instead of sitting in a grid: under Blueprint every
// piece carries a label (its type, its property, a hidden value written out), and a grid's fixed
// columns would stack them on each other. The labels then flow with the pieces they name.
export default css`
  ${rules}
  & {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
  }
  & > img {
    flex: none;
  }
  hgroup {
    flex: 1 1 16rem;
  }
  [itemprop='offers'] > div {
    flex-wrap: wrap;
  }
  menu {
    margin-inline-start: auto;
    a[href] {
      inline-size: auto;
      padding-inline: 0.3rem;
    }
  }
`;
