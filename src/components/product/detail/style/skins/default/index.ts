import { css } from 'framework';

// The dialog renders in a portal, in the modal the page opened; the dialog takes this component's
// class, so the skin reaches it.
export default css`
  hgroup p {
    color: var(--muted);
    text-transform: capitalize;
  }
  ul[aria-label] {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    border-radius: var(--radius-s);
    li {
      flex: none;
      scroll-snap-align: start;
    }
    img {
      inline-size: 11rem;
      block-size: 11rem;
      border-radius: var(--radius-s);
      background: var(--surface-2);
      object-fit: contain;
    }
  }
  [itemprop='offers'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  [itemprop='price'] {
    font-size: 1.3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  [itemprop='inventoryLevel'],
  [itemprop='additionalProperty'] {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/InStock']) [itemprop='inventoryLevel'] {
    background: var(--ok-soft);
    color: var(--ok);
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/LimitedAvailability'])
    [itemprop='inventoryLevel'] {
    background: var(--warn-soft);
    color: var(--warn);
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/OutOfStock']) [itemprop='inventoryLevel'] {
    background: var(--danger-soft);
    color: var(--danger);
  }
  /* Changed in this browser. */
  [itemprop='additionalProperty'] {
    background: var(--accent-soft);
    color: var(--accent);
  }
  /* While the product is read: its title, its pictures and its facts, as shapes. */
  &[aria-busy='true'] article > div {
    border-radius: var(--radius-s);
    background: var(--placeholder);
    animation: shimmer 1.4s linear infinite;
    &:nth-child(1) {
      inline-size: 60%;
      block-size: 1.6rem;
    }
    &:nth-child(2) {
      block-size: 9rem;
    }
    &:nth-child(3) {
      block-size: 3rem;
    }
  }
`;
