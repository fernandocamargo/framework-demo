import { css } from 'framework';

export default css`
  select {
    inline-size: 100%;
    gap: 0.4rem;
    min-inline-size: 0;
    min-block-size: 2.4rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-s);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    transition: border-color 120ms var(--ease);
    &:hover {
      border-color: var(--muted);
    }
    &:focus-visible {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
  }
  /* Firefox keeps the styled closed control and the platform's list until base-select is supported. */
  @supports (appearance: base-select) and selector(::picker(select)) {
    select,
    select::picker(select) {
      appearance: base-select;
    }
    select::picker-icon {
      content: '';
      flex: none;
      inline-size: 1.1rem;
      block-size: 1.1rem;
      background: currentColor;
      mask: var(--glyph-chevron) center / contain no-repeat;
    }
    select::picker(select) {
      position-area: block-end span-inline-end;
      position-try-fallbacks: flip-block, flip-inline;
      inset: auto;
      margin: 0;
      min-inline-size: anchor-size(self-inline);
      max-block-size: min(22rem, 60vh);
      padding: 0.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-s);
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow);
      overflow: auto;
      opacity: 1;
      translate: 0;
      transition:
        opacity 140ms var(--ease),
        translate 140ms var(--ease);
    }
    @starting-style {
      select::picker(select) {
        opacity: 0;
        translate: 0 6px;
      }
    }
    option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.45rem 0.6rem;
      border-radius: 4px;
      cursor: default;
      &:hover,
      &:focus {
        background: var(--accent-soft);
        box-shadow: none;
      }
      &:checked {
        font-weight: 600;
      }
      &::checkmark {
        content: '';
        order: 1;
        inline-size: 1em;
        block-size: 1em;
        background: var(--accent);
        mask: var(--glyph-check) center / contain no-repeat;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      select::picker(select) {
        transition: none;
      }
    }
  }
`;
