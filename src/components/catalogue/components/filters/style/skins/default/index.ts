import { css } from 'framework';

export default css`
  & {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) 13rem 13rem;
    gap: 0.5rem;
  }
  form {
    position: relative;
    min-inline-size: 0;
  }
  input,
  select {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 2.4rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-s);
    background: var(--surface);
    color: var(--text);
    transition: border-color 120ms var(--ease);
    &:hover {
      border-color: var(--muted);
    }
    &:focus-visible {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
  }
  input {
    padding-inline: 2.2rem;
    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    &::placeholder {
      color: var(--muted);
    }
    &::-webkit-search-cancel-button {
      display: none;
    }
  }
  form::before,
  form button::before {
    content: '';
    display: inline-block;
    inline-size: 1.1rem;
    block-size: 1.1rem;
    background: currentColor;
    mask: var(--glyph-search) center / contain no-repeat;
  }
  form::before {
    position: absolute;
    inset: 50% auto auto 0.7rem;
    translate: 0 -50%;
    color: var(--muted);
    pointer-events: none;
  }
  form button {
    position: absolute;
    inset: 50% 0.2rem auto auto;
    translate: 0 -50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2rem;
    min-block-size: 2rem;
    padding: 0;
    border: 0;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    &[hidden] {
      display: none;
    }
    &::before {
      mask-image: var(--glyph-close);
    }
  }
  select {
    cursor: pointer;
  }
  /* Firefox keeps the styled closed control and the platform's list until base-select is supported. */
  @supports (appearance: base-select) {
    select,
    select::picker(select) {
      appearance: base-select;
    }
    select > button {
      display: flex;
      align-items: center;
      inline-size: 100%;
      color: inherit;
      font: inherit;
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
  @media (max-width: 44rem) {
    & {
      grid-template-columns: 1fr 1fr;
    }
    form {
      grid-column: 1 / -1;
    }
  }
`;
