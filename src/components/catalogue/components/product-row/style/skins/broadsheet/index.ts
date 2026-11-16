import { css } from 'framework';

// A product as an item in the paper's columns: its photograph in halftone grey, its name as a
// headline, its price set large, and its commands as glyphs.
export default css`
  & {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'picture picture'
      'name name'
      'stock price'
      'rating commands';
    align-content: start;
    gap: 0.5rem 0.75rem;
    padding: 1rem;
    border-inline-end: 1px solid var(--text);
    border-block-end: 1px solid var(--text);
    transition: background 120ms var(--ease);
  }
  &:hover {
    background: var(--surface);
  }
  & > img,
  &:not(:has(> img))::before {
    grid-area: picture;
    inline-size: 100%;
    block-size: auto;
    aspect-ratio: 4 / 3;
    border: 1px solid var(--text);
    object-fit: cover;
    filter: grayscale(1) contrast(1.2);
    mix-blend-mode: multiply;
  }
  &:not(:has(> img))::before {
    content: '';
    background: var(--placeholder);
  }
  hgroup {
    grid-area: name;
    min-inline-size: 0;
    h3 {
      font-size: 1.3rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.15;
    }
    .react-aria-Link {
      color: var(--text);
      text-decoration: none;
      &[data-hovered] {
        text-decoration: underline;
      }
    }
    p {
      margin-block-start: 0.25rem;
      color: var(--muted);
      font-family: var(--sans);
      font-size: 0.66rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  }
  /* Changed in this browser: a stamp beside the headline. */
  [itemprop='additionalProperty'] {
    display: inline-block;
    margin-inline-start: 0.4rem;
    padding: 0.05rem 0.35rem;
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--sans);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    vertical-align: 0.25em;
    rotate: -3deg;
  }
  [itemprop='offers'] {
    display: contents;
    > div {
      grid-area: stock;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
  }
  [itemprop='inventoryLevel'] {
    font-size: 0.9rem;
    font-style: italic;
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/LimitedAvailability'])
    [itemprop='inventoryLevel'] {
    color: var(--warn);
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/OutOfStock']) [itemprop='inventoryLevel'] {
    color: var(--accent);
    font-style: normal;
    font-weight: 700;
    text-decoration: line-through;
  }
  [itemprop='price'] {
    grid-area: price;
    justify-self: end;
    font-size: 1.55rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  [itemprop='aggregateRating'] {
    grid-area: rating;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-family: var(--sans);
    font-size: 0.78rem;
  }
  menu {
    grid-area: commands;
    justify-self: end;
    display: flex;
    gap: 0.25rem;
    > li:empty {
      display: none;
    }
    .react-aria-Link {
      inline-size: 2rem;
      min-block-size: 2rem;
      padding: 0;
      border-color: transparent;
      box-shadow: none;
    }
    [itemprop='name'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
`;
