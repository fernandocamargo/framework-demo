import { css } from 'framework';

export default css`
  &.react-aria-Modal {
    inline-size: min(44rem, 100%);
  }
  hgroup p {
    color: var(--muted);
  }
  /* The steps: those before the current one are done. */
  [itemprop='actionProcess'] {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.35rem;
    li {
      padding-block-start: 0.4rem;
      border-block-start: 3px solid var(--border);
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    li:has(~ [aria-current]) {
      border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    }
    li[aria-current] {
      border-color: var(--accent);
      color: var(--text);
    }
  }
  .react-aria-CheckboxGroup > div {
    display: grid;
    max-block-size: 16rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-s);
    overflow: auto;
    .react-aria-Checkbox {
      padding: 0.5rem 0.7rem;
      & + .react-aria-Checkbox {
        border-block-start: 1px solid var(--border);
      }
      &[data-hovered] {
        background: var(--surface-2);
      }
      /* The mark sits on the box, past the row's padding. */
      &::after {
        inset-inline-start: 0.9rem;
      }
    }
    [itemtype='https://schema.org/Product'] {
      display: flex;
      flex: 1;
      gap: 0.6rem;
      [itemprop='name'] {
        flex: 1;
      }
    }
    [itemprop='price'] {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
  }
  fieldset {
    display: grid;
    grid-template-columns: auto minmax(8rem, 12rem);
    gap: 1.25rem;
    align-items: end;
    justify-content: start;
  }
  /* While the category's products are read. */
  [aria-busy='true'] {
    block-size: 12rem;
    border-radius: var(--radius-s);
    background: var(--placeholder);
    animation: shimmer 1.4s linear infinite;
  }
  table {
    inline-size: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    th,
    td {
      padding: 0.4rem 0.5rem;
      border-block-end: 1px solid var(--border);
      text-align: end;
      font-weight: 400;
    }
    th:first-child {
      text-align: start;
    }
    thead th {
      color: var(--muted);
      font-size: 0.87rem;
      font-weight: 600;
    }
  }
  p:has(> progress) {
    display: grid;
    gap: 0.35rem;
  }
  /* One replacement per product: done, or failed with why. */
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
      padding: 0.4rem 0.2rem;
      border-block-end: 1px solid var(--border);
      &::before {
        content: '';
        inline-size: 1.1rem;
        block-size: 1.1rem;
        align-self: center;
        background: var(--ok);
        mask: var(--glyph) center / contain no-repeat;
        -webkit-mask: var(--glyph) center / contain no-repeat;
      }
    }
    li:has(> [itemprop='actionStatus'][href='https://schema.org/FailedActionStatus']) {
      --glyph: var(--glyph-alert);
      &::before {
        background: var(--danger);
      }
    }
    [itemprop='error'] {
      color: var(--danger);
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
