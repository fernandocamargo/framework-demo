import { css } from 'framework';

// The report as a newspaper's front page: a headline set large in the serif, its deck in italic under
// a rule, the figures in one line of small capitals between rules, the table as market listings
// (tabular figures, hairlines, no bars: the number stands for the bar), and the closest products in
// three columns of briefs.
export default css`
  & {
    display: grid;
    gap: 1.25rem;
  }
  & > header {
    display: grid;
    gap: 0.5rem;
    padding-block-start: 0.6rem;
    border-block-start: 5px solid var(--text);
  }
  & > header h2 {
    font-family: var(--serif);
    font-size: clamp(2.2rem, 6vw, 4.2rem);
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  & > header p {
    padding-block-end: 0.6rem;
    border-block-end: 1px solid var(--text);
    font-style: italic;
    font-size: 1.15rem;
  }
  & > header time {
    font-family: var(--sans);
    font-size: 0.7rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  dl {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem 1.5rem;
    margin: 0;
    padding-block: 0.6rem;
    border-block: 1px solid var(--text);
    div {
      display: flex;
      gap: 0.4rem;
      align-items: baseline;
    }
    dt {
      font-family: var(--sans);
      font-size: 0.7rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  }
  table {
    inline-size: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    caption {
      font-family: var(--sans);
      font-size: 0.74rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      text-align: start;
      padding-block-end: 0.4rem;
    }
    th,
    td {
      padding: 0.4rem 0.6rem;
      border-block-end: 1px solid var(--border-strong);
      text-align: start;
    }
    thead th {
      font-family: var(--sans);
      font-size: 0.66rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border-block-end-width: 2px;
    }
    td:nth-child(n + 2) {
      text-align: end;
    }
  }
  /* The number stands for the bar: the meter is not drawn. */
  meter {
    display: none;
  }
  section > h3 {
    font-family: var(--sans);
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding-block-start: 0.6rem;
    border-block-start: 4px double var(--text);
  }
  section > ul {
    columns: 3 14rem;
    column-gap: 1.25rem;
    column-rule: 1px solid var(--text);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  section > ul > li {
    break-inside: avoid;
    padding-block-end: 0.7rem;
    margin-block-end: 0.7rem;
    border-block-end: 1px solid var(--border);
  }
  section > ul > li a {
    font-weight: 600;
  }
  [itemprop='offers'] {
    display: flex;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--muted);
  }
`;
