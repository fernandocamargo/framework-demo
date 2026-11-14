import { css } from 'framework';

// Two elements carry this component's class: the widget in the header, and the sign-in dialog's
// modal, which renders in a portal.
export default css`
  &:not(.react-aria-Modal) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  /* Signed in: the way out stays quiet beside who it is. */
  &:not(.react-aria-Modal):has([itemscope]) > .react-aria-Button {
    border-color: transparent;
    background: transparent;
    &[data-hovered] {
      background: var(--surface-2);
    }
  }
  /* Nobody signed in: the way in shows who it is for. */
  &:not(.react-aria-Modal):not(:has([itemscope])) > .react-aria-Button::before {
    content: '';
    inline-size: 1.1rem;
    block-size: 1.1rem;
    background: currentColor;
    mask: var(--glyph-user) center / contain no-repeat;
    -webkit-mask: var(--glyph-user) center / contain no-repeat;
  }
  &.react-aria-Modal {
    inline-size: min(26rem, 100%);
  }
  [itemtype='https://schema.org/Person'] {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.5rem;
    line-height: 1.2;
    /* A person with no picture: where it would be. */
    &:not(:has(> img))::before {
      content: '';
      inline-size: 1.1rem;
      block-size: 1.1rem;
      background: currentColor;
      mask: var(--glyph-user) center / contain no-repeat;
      -webkit-mask: var(--glyph-user) center / contain no-repeat;
    }
    img {
      border-radius: 50%;
      background: var(--surface-2);
    }
    div {
      display: grid;
    }
    strong {
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
  }
  [itemprop='jobTitle'] {
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  [role='timer'] {
    color: var(--muted);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    &[aria-busy='true'] {
      color: var(--accent);
    }
  }
  form {
    display: grid;
    gap: 0.75rem;
  }
  aside {
    color: var(--muted);
    font-size: 0.9rem;
    code {
      padding: 0.05rem 0.3rem;
      border-radius: 4px;
      background: var(--surface-2);
      color: var(--text);
    }
    /* The demo accounts read as links that fill the form in. */
    menu {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.9rem;
      margin-block-start: 0.25rem;
    }
    .react-aria-Button {
      min-block-size: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      cursor: pointer;
      &[data-hovered] {
        background: none;
        text-decoration: underline;
      }
    }
  }
  @media (max-width: 36rem) {
    [itemtype='https://schema.org/Person'] div {
      display: none;
    }
  }
`;
