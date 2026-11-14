import { css } from 'framework';

import tiles from '../../tiles';

// The map as tiles on a grid of the country's shape. Each tile's fill is its meter, stretched behind
// the text in soft tints of the accent: the more orders, the stronger the tint. The current state is ringed.
export default css`
  ${tiles}
  & {
    display: grid;
    gap: 0.6rem;
    margin: 0;
  }
  figcaption {
    color: var(--muted);
    font-size: 0.87rem;
  }
  ol {
    display: grid;
    grid-template-columns: repeat(11, minmax(0, 1fr));
    grid-template-rows: repeat(8, minmax(3.4rem, auto));
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    min-inline-size: 0;
  }
  .react-aria-Link {
    position: relative;
    isolation: isolate;
    display: grid;
    align-content: center;
    justify-items: center;
    block-size: 100%;
    padding: 0.3rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-s);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    &[data-hovered] {
      border-color: var(--border-strong);
    }
    &[data-focus-visible] {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    &[aria-current='true'] {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent);
    }
  }
  /* The state's own glyph (base.css) is no part of a tile: its abbreviation names it. */
  .react-aria-Link [itemprop='observationAbout']::before {
    content: none;
  }
  abbr {
    font-weight: 700;
    text-decoration: none;
  }
  data {
    color: var(--muted);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  meter {
    position: absolute;
    inset: 0;
    z-index: -1;
    appearance: none;
    inline-size: 100%;
    block-size: 100%;
    border: 0;
    background: none;
    /* Chromium lays the meter out as a grid of three rows, with its bar in the middle one at half the
       height: the bar takes the whole tile only once the outer rows are empty. */
    &::-webkit-meter-inner-element {
      grid-template-rows: 0 1fr 0;
    }
    &::-webkit-meter-bar {
      block-size: 100%;
      border: 0;
      background: transparent;
    }
    &::-webkit-meter-optimum-value {
      block-size: 100%;
      background: color-mix(in oklab, var(--accent) 55%, var(--surface));
    }
    &::-webkit-meter-suboptimum-value {
      block-size: 100%;
      background: color-mix(in oklab, var(--accent) 30%, var(--surface));
    }
    &::-webkit-meter-even-less-good-value {
      block-size: 100%;
      background: color-mix(in oklab, var(--accent) 12%, var(--surface));
    }
    &::-moz-meter-bar {
      background: color-mix(in oklab, var(--accent) 12%, var(--surface));
    }
    &:-moz-meter-optimum::-moz-meter-bar {
      background: color-mix(in oklab, var(--accent) 55%, var(--surface));
    }
    &:-moz-meter-sub-optimum::-moz-meter-bar {
      background: color-mix(in oklab, var(--accent) 30%, var(--surface));
    }
    &:-moz-meter-sub-sub-optimum::-moz-meter-bar {
      background: color-mix(in oklab, var(--accent) 12%, var(--surface));
    }
  }
  /* While the orders are read: the map's frame, empty. */
  &[aria-busy='true'] ol {
    min-block-size: 26rem;
  }
`;
