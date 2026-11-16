import { css } from 'framework';

// The ledger: a bordered list of orders, one to a row, each with its number, customer, place,
// items and price laid across it.
export default css`
  & {
    display: grid;
    gap: 0.8rem;
  }
  & > header p {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  ul[aria-label] {
    display: grid;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  li {
    display: grid;
    grid-template-columns: minmax(6rem, auto) minmax(9rem, 1fr) minmax(10rem, 1.3fr) auto auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1rem;
    border-block-start: 1px solid var(--border);
    font-size: 0.92rem;
    &:first-child {
      border-block-start: 0;
    }
    .react-aria-Link {
      font-weight: 700;
    }
    [itemprop='orderNumber'] {
      font-variant-numeric: tabular-nums;
    }
    [itemprop='addressRegion'] {
      font-weight: 600;
    }
    [itemprop='acceptedOffer'] {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
  }
  & > p:not([role]) {
    display: grid;
    justify-items: center;
    padding: 2.5rem 1rem;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    color: var(--muted);
  }
  nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  &[aria-busy='true'] ul {
    display: grid;
    gap: 0.5rem;
    li {
      block-size: 3.2rem;
      border: 0;
      border-radius: var(--radius-s);
      background: var(--placeholder);
      animation: shimmer 1.4s linear infinite;
    }
  }
`;
