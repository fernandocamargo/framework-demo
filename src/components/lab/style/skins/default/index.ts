import { css } from 'framework';

export default css`
  > .react-aria-Button {
    border-color: transparent;
    background: transparent;
    &::before {
      content: '';
      inline-size: 1.1rem;
      block-size: 1.1rem;
      background: currentColor;
      mask: var(--glyph-signal) center / contain no-repeat;
      -webkit-mask: var(--glyph-signal) center / contain no-repeat;
    }
    &[data-hovered] {
      background: var(--surface-2);
    }
    /* Faults on: the toggle counts them. */
    &:has(data) {
      background: var(--warn-soft);
      color: var(--warn);
    }
    data {
      display: grid;
      place-items: center;
      min-inline-size: 1.3rem;
      block-size: 1.3rem;
      border-radius: 1rem;
      background: var(--warn);
      color: var(--surface);
      font-size: 0.78rem;
    }
  }
  /* Docked beside the page on a wide screen (the app's skin makes room for it), a sheet at the
     bottom on a narrow one. render.tsx puts it at the end of the page, with this component's
     class, so these rules reach it. */
  &:is(aside) {
    position: fixed;
    inset: var(--header) 0 0 auto;
    z-index: 30;
    display: grid;
    grid-template-rows: auto auto auto auto minmax(12rem, 1fr);
    gap: 0.9rem;
    inline-size: var(--lab);
    padding: 1rem;
    border-inline-start: 1px solid var(--border);
    background: var(--surface);
    overflow: auto;
  }
  @media (max-width: 64rem) {
    &:is(aside) {
      inset: auto 0.5rem 0.5rem;
      inline-size: auto;
      max-block-size: 60dvh;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      animation: rise 200ms var(--ease);
    }
  }
  &:is(aside) > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    h2 {
      font-size: 1.05rem;
    }
  }
  [itemprop='description']:is(p) {
    color: var(--muted);
    font-size: 0.9rem;
  }
  fieldset {
    display: grid;
    gap: 0.9rem;
  }
  &:is(aside) > menu {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    .react-aria-Button {
      min-block-size: 2rem;
      padding: 0 0.6rem;
      font-size: 0.87rem;
    }
  }
  ol {
    display: grid;
    gap: 0.35rem;
    align-content: start;
    overflow: auto;
    font-size: 0.82rem;
    li {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      align-items: baseline;
      gap: 0.4rem;
      overflow-wrap: anywhere;
    }
    /* Nothing yet. */
    li:not([itemscope]) {
      display: block;
      color: var(--muted);
    }
    time {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    small {
      color: var(--muted);
    }
    code {
      font-size: 0.78rem;
      margin-inline-end: 0.3rem;
    }
    /* What each entry is, coloured by what became of it. */
    [itemprop='name'] {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
    }
    li:has(> [itemprop='actionStatus'][href='https://schema.org/CompletedActionStatus']) [itemprop='name'] {
      background: var(--ok-soft);
      color: var(--ok);
    }
    li:has(> [itemprop='actionStatus'][href='https://schema.org/FailedActionStatus']) [itemprop='name'] {
      background: var(--danger-soft);
      color: var(--danger);
    }
    li:has(> [itemprop='actionStatus'][href='https://schema.org/ActiveActionStatus']) [itemprop='name'] {
      background: var(--warn-soft);
      color: var(--warn);
    }
    /* What the person did starts a group: the reads and the work it caused follow. */
    li:has(> [itemprop='agent']) {
      padding-block-start: 0.35rem;
      border-block-start: 1px solid var(--border);
    }
  }
  /* Below a wide screen the button is its icon alone: the header's tools share one row. */
  @media (max-width: 75rem) {
    > .react-aria-Button > span {
      display: none;
    }
  }
`;
