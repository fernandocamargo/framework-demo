import { css } from 'framework';

// The network lab as the paper's back page: a column of its own down the side, its logs set as
// the wire service's ticker, in type.
export default css`
  > .react-aria-Button {
    border-color: transparent;
    &::before {
      content: '';
      inline-size: 1rem;
      block-size: 1rem;
      background: currentColor;
      mask: var(--glyph-signal) center / contain no-repeat;
      -webkit-mask: var(--glyph-signal) center / contain no-repeat;
    }
    &:has(data) {
      border-color: var(--accent);
      color: var(--accent);
    }
    data {
      padding-inline: 0.3rem;
      background: var(--accent);
      color: var(--on-accent);
    }
  }
  &:is(aside) {
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 30;
    display: grid;
    grid-template-rows: auto auto auto auto minmax(12rem, 1fr);
    gap: 0.9rem;
    inline-size: var(--lab);
    padding: 1rem 1.1rem;
    border-inline-start: 4px double var(--text);
    background: var(--surface);
    overflow: auto;
  }
  @media (max-width: 64rem) {
    &:is(aside) {
      inset: auto 0.5rem 0.5rem;
      inline-size: auto;
      max-block-size: 60dvh;
      border: 2px solid var(--text);
      box-shadow: var(--shadow);
    }
  }
  &:is(aside) > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block-end: 0.4rem;
    border-block-end: 3px double var(--text);
    h2 {
      font-family: var(--sans);
      font-size: 0.85rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
  }
  [itemprop='description']:is(p) {
    font-size: 0.92rem;
    font-style: italic;
  }
  fieldset {
    display: grid;
    gap: 1rem;
  }
  &:is(aside) > menu {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    .react-aria-Button {
      min-block-size: 1.9rem;
      padding: 0 0.5rem;
      font-size: 0.64rem;
    }
  }
  @media (max-width: 44rem) {
    > .react-aria-Button > span {
      display: none;
    }
  }
`;
