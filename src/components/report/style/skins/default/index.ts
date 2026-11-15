import { css } from 'framework';

// A quiet dashboard: the figures as cards in a row, the table with each category's units drawn as
// a bar, and the products closest to running out as compact rows.
export default css`
  & {
    display: grid;
    gap: 1.5rem;
  }
  & > header hgroup {
    display: grid;
    gap: 0.35rem;
    h2 {
      font-size: 1.45rem;
    }
    p {
      color: var(--muted);
    }
  }
  & > header time {
    color: var(--muted);
    font-size: 0.85rem;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.75rem;
    margin: 0;
    div {
      display: grid;
      gap: 0.25rem;
      padding: 0.85rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    dt {
      color: var(--muted);
      font-size: 0.8rem;
    }
    dd {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  }
  table {
    inline-size: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    caption {
      padding-block-end: 0.5rem;
      color: var(--muted);
      text-align: start;
    }
    th,
    td {
      padding: 0.5rem 0.6rem;
      border-block-end: 1px solid var(--border);
      text-align: start;
    }
    thead th {
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 600;
    }
  }
  meter {
    appearance: none;
    display: inline-block;
    vertical-align: middle;
    inline-size: 6rem;
    block-size: 0.6rem;
    margin-inline-start: 0.5rem;
    border: 0;
    border-radius: var(--radius-s);
    background: var(--surface-2);
    &::-webkit-meter-bar {
      border: 0;
      border-radius: var(--radius-s);
      background: var(--surface-2);
    }
    &::-webkit-meter-optimum-value,
    &::-webkit-meter-suboptimum-value,
    &::-webkit-meter-even-less-good-value {
      background: var(--accent);
    }
    &::-moz-meter-bar {
      background: var(--accent);
    }
  }
  @media (max-width: 40rem) {
    table {
      font-size: 0.8rem;
      th,
      td {
        padding-inline: 0.2rem;
      }
      /* Blueprint's labels would become extra columns in a narrow table. */
      [itemscope]::before,
      [itemprop]::after {
        content: none;
      }
    }
    meter {
      display: none;
    }
    [itemprop='offers'] {
      flex-wrap: wrap;
    }
  }
  section > ul {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  section > ul > li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding-block: 0.4rem;
    border-block-end: 1px solid var(--border);
  }
  [itemprop='offers'] {
    display: flex;
    gap: 0.5rem;
    color: var(--muted);
    font-size: 0.9rem;
  }
  h3 {
    font-size: 1.05rem;
  }
`;
