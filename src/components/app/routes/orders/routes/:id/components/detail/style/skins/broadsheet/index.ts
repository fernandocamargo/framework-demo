import { css } from 'framework';

// The order as a notice of sale in the paper: its number as a headline, the customer and the
// address set in italics, the items in a column between rules, and the total at the foot.
export default css`
  hgroup p {
    font-style: italic;
    color: var(--muted);
  }
  [itemprop='orderNumber'] {
    font-family: var(--serif);
  }
  [itemprop='orderDelivery'] {
    padding-block: 0.5rem;
    border-block: 1px solid var(--text);
    font-size: 0.92rem;
  }
  address {
    font-style: normal;
    [itemprop='streetAddress'],
    [itemprop='addressCountry'] {
      display: block;
    }
    p {
      color: var(--muted);
      font-style: italic;
    }
  }
  ol[aria-label] {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
    border-block-end: 1px solid var(--text);
    li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.6rem;
      padding-block: 0.45rem;
      border-block-start: 1px solid var(--text);
      font-size: 0.92rem;
    }
    img {
      inline-size: 2.2rem;
      block-size: 2.2rem;
      object-fit: contain;
      border: 1px solid var(--text);
    }
    .react-aria-Link {
      font-weight: 700;
    }
  }
  [itemprop='acceptedOffer'] {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 0.5rem;
    font-family: var(--sans);
    font-size: 0.74rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  [itemprop='acceptedOffer'] [itemprop='price'] {
    font-family: var(--serif);
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
  }
  & article[aria-busy='true'] > div {
    border: 1px solid var(--text);
    background: var(--placeholder);
    animation: shimmer 2.4s linear infinite;
    &:nth-child(1) {
      inline-size: 60%;
      block-size: 1.6rem;
    }
    &:nth-child(2) {
      block-size: 4rem;
    }
    &:nth-child(3) {
      block-size: 6rem;
    }
  }
`;
