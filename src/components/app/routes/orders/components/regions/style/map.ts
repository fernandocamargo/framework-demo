import { css } from 'framework';

// What every skin does once the live map shows (widgets/live-map puts it in the figure, and takes
// `hidden` off when its first frame is ready): the map takes the figure's width, and the tiles stop
// being a map of their own and become its legend, in rows. A tile with no orders is hidden visually
// and stays in the accessibility tree; it shows again while it holds the focus. The figure's
// `accent-color` and `color` are what the map draws its circles and their outlines with, so each
// skin sets them.
export default css`
  &:has(> .maplibregl-map:not([hidden])) {
    > .maplibregl-map {
      inline-size: 100%;
      aspect-ratio: 16 / 10;
      max-block-size: 24rem;
    }
    /* The circles say how many: the meter's fill would say it twice, and half a chip looks unfinished. */
    meter {
      display: none;
    }
    > ol {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    li {
      flex: none;
      min-inline-size: 3.6rem;
    }
    a[href] {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      block-size: auto;
      min-block-size: 0;
      padding: 0.2rem 0.55rem;
    }
    li:has([itemprop='value'][value='0']):not(:focus-within) {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      min-inline-size: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
`;
