import { css } from 'framework';

import rules from '../default';

// The map under Blueprint: the same tiles, each with its observation named at its top edge. The
// page's own labels name every property by its itemprop, and a tile of 11 columns has no room for
// those names beside its abbreviation and count, so the tile's properties go unlabelled; the
// abbreviation names the state, and the count is the value. Nothing else in the markup changes.
export default css`
  ${rules}
  ol {
    gap: 0.5rem 0.3rem;
  }
  li {
    position: relative;
    padding-block-start: 0.9rem;
  }
  li[itemtype$='/Observation']::before {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    max-inline-size: 100%;
    overflow: hidden;
    font-size: 0.55rem;
    white-space: nowrap;
  }
  .react-aria-Link {
    align-content: start;
    min-block-size: 5.2rem;
    font-size: 0.7rem;
  }
  [itemprop='alternateName']::after,
  [itemprop='observationAbout']::after,
  [itemprop='geo']::before,
  [itemprop='geo']::after,
  [itemprop='value']::after {
    content: none;
  }
`;
