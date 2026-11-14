import { css } from 'framework';

export default css`
  & {
    display: grid;
    gap: 1rem;
  }
  & > header {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 0.75rem;
    h2 {
      font-size: 1.5rem;
      letter-spacing: -0.02em;
    }
    p {
      color: var(--muted);
    }
    menu {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    /* Creating a product is the catalogue's first step. */
    .react-aria-Link:has(> [itemtype='https://schema.org/CreateAction']) {
      border-color: transparent;
      background: var(--accent);
      color: var(--on-accent);
      &[data-hovered] {
        background: var(--accent-hover);
      }
    }
  }
  ul[aria-label] {
    display: grid;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  /* Nothing to list: what is missing, and a way back to everything. */
  & > p:not([role]) {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
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
  /* While the catalogue is read: its rows, as shapes. */
  &[aria-busy='true'] ul {
    display: grid;
    gap: 0.5rem;
    li {
      block-size: 4.6rem;
      border-radius: var(--radius-s);
      background: var(--placeholder);
      animation: shimmer 1.4s linear infinite;
    }
  }
`;
