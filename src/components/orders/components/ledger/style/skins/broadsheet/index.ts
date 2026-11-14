import { css } from 'framework';

// The ledger as a column of classified notices: each order a short notice between rules, its number
// in capitals, its customer and place in italics, and its price set at the end.
export default css`
  & {
    display: grid;
    gap: 1rem;
  }
  & > header p {
    color: var(--muted);
    font-style: italic;
  }
  ul[aria-label] {
    display: grid;
    border-block-start: 3px double var(--text);
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    gap: 0.25rem 1rem;
    padding: 0.7rem 0;
    border-block-end: 1px solid var(--text);
    font-size: 0.95rem;
    .react-aria-Link {
      font-family: var(--sans);
      font-size: 0.74rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    [itemprop='customer'] {
      font-style: italic;
    }
    [itemprop='orderDelivery'] {
      grid-column: 2;
      color: var(--muted);
      font-size: 0.86rem;
    }
    [itemprop='acceptedOffer'] {
      font-family: var(--serif);
      font-weight: 700;
    }
    & > span:not([itemprop]) {
      color: var(--muted);
      font-size: 0.82rem;
    }
  }
  & > p:not([role]) {
    padding: 2.5rem 1rem;
    border: 1px solid var(--text);
    font-size: 1.15rem;
    font-style: italic;
    text-align: center;
  }
  nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    font-family: var(--sans);
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  &[aria-busy='true'] ul {
    display: grid;
    gap: 0.5rem;
    li {
      block-size: 2.6rem;
      border: 1px solid var(--text);
      background: var(--placeholder);
      animation: shimmer 2.4s linear infinite;
    }
  }
`;
