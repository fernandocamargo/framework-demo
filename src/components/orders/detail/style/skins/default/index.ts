import { css } from 'framework';

// The order's dialog: its heading with the customer under it, the address, the items as a row of
// thumbnails with their quantities, and the total in the accent's weight.
export default css`
  hgroup p {
    color: var(--muted);
  }
  [itemprop='orderDelivery'] {
    display: grid;
    padding-block: 0.6rem;
    border-block: 1px solid var(--border);
    font-size: 0.9rem;
  }
  address {
    font-style: normal;
    line-height: 1.5;
    [itemprop='streetAddress'] {
      display: block;
      font-weight: 600;
    }
    [itemprop='addressCountry'] {
      display: block;
      color: var(--muted);
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 0.82rem;
    }
  }
  ol[aria-label] {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
    li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.92rem;
    }
    [itemprop='orderQuantity'] {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    span[itemprop='orderedItem'] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    img {
      inline-size: 2.6rem;
      block-size: 2.6rem;
      border-radius: var(--radius-s);
      background: var(--surface-2);
      object-fit: contain;
    }
    .react-aria-Link {
      font-weight: 600;
    }
  }
  [itemprop='acceptedOffer'] {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.5rem;
    color: var(--muted);
  }
  [itemprop='acceptedOffer'] [itemprop='price'] {
    color: var(--text);
    font-size: 1.2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  /* While the order is read: its title, its address and its items, as shapes. */
  & article[aria-busy='true'] > div {
    border-radius: var(--radius-s);
    background: var(--placeholder);
    animation: shimmer 1.4s linear infinite;
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
