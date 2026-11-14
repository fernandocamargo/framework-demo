import { css } from 'framework';

import rules from '../default';

// The map under Blueprint: the same tiles, each with its observation named at its top edge. The
// page's own labels name every property by its itemprop, and a tile of 11 columns has no room for
// those names beside its abbreviation and count, so the tile's properties go unlabelled; the
// abbreviation names the state, and the count is the value. Nothing else in the markup changes.
export default css`
  ${rules}
  /* The live map's circles are outlined in the ground's navy, which the pale basemap shows; the
     figure's own words keep the page's text. */
  & {
    color: var(--bg);
  }
  figcaption,
  ol {
    color: var(--text);
  }
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
  /* With the live map the tiles are its legend, in rows: their labels would not fit, and the map has none. */
  &:has(> .maplibregl-map:not([hidden])) {
    li {
      padding-block-start: 0;
    }
    meta,
    [itemprop='geo'] {
      display: none;
    }
    li[itemtype$='/Observation']::before {
      content: none;
    }
    .react-aria-Link {
      min-block-size: 0;
    }
  }
  [itemprop='alternateName']::after,
  [itemprop='observationAbout']::after,
  [itemprop='geo']::before,
  [itemprop='geo']::after,
  [itemprop='value']::after {
    content: none;
  }
`;
