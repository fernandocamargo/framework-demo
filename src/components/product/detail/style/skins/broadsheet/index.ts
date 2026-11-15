import { css } from 'framework';

// A product as an article: its brand and category as the kicker above the headline, its
// photographs in halftone, its price in the standfirst, and its description with a drop cap.
export default css`
  hgroup {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.3rem;
    .react-aria-Heading {
      font-size: 2.3rem;
    }
    p {
      color: var(--accent);
      font-family: var(--sans);
      font-size: 0.7rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
  }
  ul[aria-label] {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    li {
      flex: none;
      scroll-snap-align: start;
    }
    img {
      inline-size: 12rem;
      block-size: 12rem;
      border: 1px solid var(--text);
      object-fit: cover;
      filter: grayscale(1) contrast(1.2);
      mix-blend-mode: multiply;
    }
  }
  [itemprop='offers'] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.75rem;
    padding-block: 0.4rem;
    border-block: 1px solid var(--text);
  }
  [itemprop='price'] {
    font-size: 1.9rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  [itemprop='inventoryLevel'] {
    font-style: italic;
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/LimitedAvailability'])
    [itemprop='inventoryLevel'] {
    color: var(--warn);
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/OutOfStock']) [itemprop='inventoryLevel'] {
    color: var(--accent);
    font-weight: 700;
  }
  [itemprop='additionalProperty'] {
    padding: 0.05rem 0.4rem;
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--sans);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  [itemprop='description'] {
    font-size: 1.08rem;
    line-height: 1.6;
    &::first-letter {
      float: left;
      padding: 0.06em 0.1em 0 0;
      color: var(--accent);
      font-size: 3.6em;
      font-weight: 700;
      line-height: 0.8;
    }
  }
  & article[aria-busy='true'] > div {
    border: 1px solid var(--text);
    background: var(--placeholder);
    animation: shimmer 2.4s linear infinite;
    &:nth-child(1) {
      inline-size: 70%;
      block-size: 2.4rem;
    }
    &:nth-child(2) {
      block-size: 12rem;
    }
    &:nth-child(3) {
      block-size: 4rem;
    }
  }
`;
