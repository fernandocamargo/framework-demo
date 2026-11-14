import { css } from 'framework';

import tiles from '../../tiles';

// The map as a newspaper's election-night map: square tiles with hairline rules, the orders drawn in
// hatched ink (three densities), and the current state inverted. Nothing is coloured.
const dense = 'repeating-linear-gradient(45deg, var(--text) 0 2px, transparent 2px 4px)';
const medium = 'repeating-linear-gradient(45deg, var(--text) 0 1px, transparent 1px 5px)';
const light = 'repeating-linear-gradient(45deg, var(--muted) 0 1px, transparent 1px 9px)';

export default css`
  ${tiles}
  & {
    display: grid;
    gap: 0.6rem;
    margin: 0;
  }
  figcaption {
    font-family: var(--serif);
    font-style: italic;
    color: var(--muted);
    font-size: 0.92rem;
  }
  ol {
    display: grid;
    grid-template-columns: repeat(11, minmax(0, 1fr));
    grid-template-rows: repeat(8, minmax(3.2rem, auto));
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border-block-start: 1px solid var(--text);
    border-inline-start: 1px solid var(--text);
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
    padding: 0.2rem;
    overflow: hidden;
    border-inline-end: 1px solid var(--text);
    border-block-end: 1px solid var(--text);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    &[data-hovered] {
      background: var(--surface-2);
    }
    &[data-focus-visible] {
      outline: 2px solid var(--accent);
      outline-offset: -4px;
    }
    /* The state on screen is inverted, as a headline on a dark ground. */
    &[aria-current='true'] {
      background: var(--text);
      color: var(--surface);
      abbr,
      data {
        background: var(--text);
        color: var(--surface);
      }
    }
  }
  .react-aria-Link [itemprop='observationAbout']::before {
    content: none;
  }
  /* The hatching sits under the words: the abbreviation and the count stand on paper. */
  abbr {
    font-family: var(--sans);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-decoration: none;
    background: var(--surface);
    padding-inline: 0.2rem;
  }
  data {
    background: var(--surface);
    padding-inline: 0.15rem;
    color: var(--muted);
    font-family: var(--serif);
    font-size: 0.8rem;
    font-variant-numeric: lining-nums;
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
      background: ${dense};
    }
    &::-webkit-meter-suboptimum-value {
      block-size: 100%;
      background: ${medium};
    }
    &::-webkit-meter-even-less-good-value {
      block-size: 100%;
      background: ${light};
    }
    &::-moz-meter-bar {
      background: ${light};
    }
    &:-moz-meter-optimum::-moz-meter-bar {
      background: ${dense};
    }
    &:-moz-meter-sub-optimum::-moz-meter-bar {
      background: ${medium};
    }
    &:-moz-meter-sub-sub-optimum::-moz-meter-bar {
      background: ${light};
    }
  }
  &[aria-busy='true'] ol {
    min-block-size: 26rem;
    background: var(--placeholder);
    animation: shimmer 2.4s linear infinite;
  }
`;
