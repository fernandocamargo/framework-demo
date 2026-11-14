import { css } from 'framework';

export default css`
  .step-text {
    color: var(--muted);
  }
  .steps {
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
    li[data-done] {
      border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    }
    li[data-current] {
      border-color: var(--accent);
      color: var(--text);
    }
  }
  .choose {
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
    }
    .title {
      flex: 1;
    }
    .price {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
  }
  .rule {
    display: grid;
    grid-template-columns: auto minmax(8rem, 12rem);
    gap: 1.25rem;
    align-items: end;
    justify-content: start;
  }
  .problem {
    color: var(--danger);
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
  .results {
    display: grid;
    max-block-size: 16rem;
    overflow: auto;
    li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: baseline;
      gap: 0.6rem;
      padding: 0.4rem 0.2rem;
      border-block-end: 1px solid var(--border);
      .icon {
        color: var(--ok);
      }
    }
    li[data-failed] .icon,
    .error {
      color: var(--danger);
    }
    .price {
      font-variant-numeric: tabular-nums;
    }
  }
  @media (max-width: 30rem) {
    .rule {
      grid-template-columns: 1fr;
    }
  }
`;
