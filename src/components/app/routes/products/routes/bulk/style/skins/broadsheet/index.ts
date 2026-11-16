import { css } from 'framework';

// The bulk change as the paper's market page: numbered steps, the products as a price list with
// dotted leaders, the preview and the results as tables of figures.
export default css`
  &.react-aria-Modal {
    inline-size: min(46rem, 100%);
  }
  hgroup p {
    font-family: var(--sans);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  [itemprop='actionProcess'] {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    counter-reset: step;
    li {
      counter-increment: step;
      padding: 0.3rem 0.2rem;
      border-block-end: 1px solid var(--text);
      color: var(--muted);
      font-family: var(--sans);
      font-size: 0.66rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      overflow: hidden;
      text-overflow: ellipsis;
      &::before {
        content: counter(step) '. ';
      }
    }
    li:has(~ [aria-current]) {
      color: var(--text);
      text-decoration: line-through;
    }
    li[aria-current] {
      border-block-end: 4px solid var(--accent);
      color: var(--text);
      font-weight: 700;
    }
  }
  .react-aria-CheckboxGroup > div {
    display: grid;
    max-block-size: 16rem;
    border-block: 1px solid var(--text);
    overflow: auto;
    .react-aria-Checkbox {
      padding: 0.45rem 0.2rem;
      & + .react-aria-Checkbox {
        border-block-start: 1px dotted var(--text);
      }
      &[data-hovered] {
        background: var(--surface-2);
      }
      &::after {
        inset-inline-start: 0.4rem;
      }
    }
    [itemtype='https://schema.org/Product'] {
      display: flex;
      flex: 1;
      align-items: baseline;
    }
    /* The leaders: dots from the name to its price. */
    [itemprop='name'] {
      display: flex;
      flex: 1;
      align-items: baseline;
      &::after {
        content: '';
        flex: 1;
        margin-inline: 0.4rem;
        border-block-end: 1px dotted var(--muted);
      }
    }
    [itemprop='price'] {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
  }
  fieldset {
    display: grid;
    grid-template-columns: auto minmax(8rem, 12rem);
    gap: 1.5rem;
    align-items: end;
    justify-content: start;
  }
  [aria-busy='true'] {
    block-size: 12rem;
    border: 1px solid var(--text);
    background: var(--placeholder);
    animation: shimmer 2.4s linear infinite;
  }
  table {
    inline-size: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    th,
    td {
      padding: 0.35rem 0.4rem;
      border-block-end: 1px dotted var(--text);
      text-align: end;
      font-weight: 400;
    }
    th:first-child {
      text-align: start;
      font-style: italic;
    }
    thead th {
      border-block-end: 2px solid var(--text);
      font-family: var(--sans);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
  }
  p:has(> progress) {
    display: grid;
    gap: 0.35rem;
    font-style: italic;
  }
  ul[aria-label] {
    display: grid;
    max-block-size: 16rem;
    overflow: auto;
    li {
      --glyph: var(--glyph-check);
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: baseline;
      gap: 0.6rem;
      padding: 0.35rem 0.2rem;
      border-block-end: 1px dotted var(--text);
      &::before {
        content: '';
        inline-size: 1rem;
        block-size: 1rem;
        align-self: center;
        background: var(--text);
        mask: var(--glyph) center / contain no-repeat;
        -webkit-mask: var(--glyph) center / contain no-repeat;
      }
    }
    li:has(> [itemprop='actionStatus'][href='https://schema.org/FailedActionStatus']) {
      --glyph: var(--glyph-alert);
      &::before {
        background: var(--accent);
      }
    }
    [itemprop='object'] {
      font-style: italic;
    }
    [itemprop='error'] {
      color: var(--accent);
    }
    li > span:last-child {
      font-variant-numeric: tabular-nums;
    }
  }
  @media (max-width: 30rem) {
    fieldset {
      grid-template-columns: 1fr;
    }
  }
`;
