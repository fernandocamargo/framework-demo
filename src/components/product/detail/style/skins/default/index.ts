import { css } from 'framework'

// The dialog renders in a portal, in the modal the page opened; the dialog takes this component's
// class, so the skin reaches it.
export default css`
  .origin {
    color: var(--muted);
    text-transform: capitalize;
  }
  .pictures {
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
  .facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .price {
    font-size: 1.3rem;
    font-variant-numeric: tabular-nums;
  }
`
