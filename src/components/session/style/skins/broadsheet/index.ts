import { css } from 'framework';

// Who is signed in, as a byline: the name in capitals, the role in italics, the token's time as
// a dateline in type.
export default css`
  &:not(.react-aria-Modal) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  &:not(.react-aria-Modal):has([itemscope]) > .react-aria-Button {
    border-color: transparent;
  }
  &:not(.react-aria-Modal):not(:has([itemscope])) > .react-aria-Button::before {
    content: '';
    inline-size: 1rem;
    block-size: 1rem;
    background: currentColor;
    mask: var(--glyph-user) center / contain no-repeat;
    -webkit-mask: var(--glyph-user) center / contain no-repeat;
  }
  &.react-aria-Modal {
    inline-size: min(28rem, 100%);
  }
  [itemtype='https://schema.org/Person'] {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.5rem;
    line-height: 1.2;
    &:not(:has(> img))::before {
      content: '';
      inline-size: 1rem;
      block-size: 1rem;
      background: currentColor;
      mask: var(--glyph-user) center / contain no-repeat;
      -webkit-mask: var(--glyph-user) center / contain no-repeat;
    }
    img {
      border: 1px solid var(--text);
      filter: grayscale(1) contrast(1.2);
    }
    div {
      display: grid;
    }
    strong {
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
      font-family: var(--sans);
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
  }
  [itemprop='jobTitle'] {
    color: var(--accent);
    font-family: var(--serif);
    font-size: 0.85rem;
    font-style: italic;
    letter-spacing: 0;
    text-transform: none;
  }
  [role='timer'] {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.7rem;
    &[aria-busy='true'] {
      color: var(--accent);
    }
  }
  form {
    display: grid;
    gap: 1rem;
  }
  aside {
    padding: 0.6rem 0.75rem;
    border: 1px dashed var(--text);
    font-size: 0.92rem;
    font-style: italic;
    code {
      font-style: normal;
    }
    menu {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      margin-block-start: 0.35rem;
    }
    .react-aria-Button {
      min-block-size: 0;
      padding: 0;
      border: 0;
      background: none;
      box-shadow: none;
      color: var(--accent);
      font-family: var(--serif);
      font-size: 0.92rem;
      letter-spacing: 0;
      text-decoration: underline;
      text-transform: none;
      &[data-hovered] {
        background: none;
        color: var(--text);
      }
    }
  }
  @media (max-width: 36rem) {
    [itemtype='https://schema.org/Person'] div {
      display: none;
    }
  }
`;
