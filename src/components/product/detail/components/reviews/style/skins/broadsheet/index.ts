import { css } from 'framework';

// The reviews as letters to the editor: each quoted, signed, and rated in ink.
export default css`
  & {
    display: grid;
    gap: 0.8rem;
    padding-block-start: 0.9rem;
    border-block-start: 4px double var(--text);
  }
  h3 {
    font-family: var(--sans);
    font-size: 0.74rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    &::before {
      margin-inline-end: 0.35rem;
      color: var(--text);
    }
  }
  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 1rem 1.5rem;
  }
  li {
    display: grid;
    gap: 0.3rem;
    padding-inline-start: 0.75rem;
    border-inline-start: 3px solid var(--text);
  }
  meter {
    appearance: none;
    display: block;
    inline-size: 5rem;
    block-size: 1rem;
    border: 0;
    background: #c9c0ae;
    mask: var(--glyph-star) 0 0 / 1rem 1rem repeat-x;
    -webkit-mask: var(--glyph-star) 0 0 / 1rem 1rem repeat-x;
    &::-webkit-meter-bar {
      border: 0;
      background: #c9c0ae;
    }
    &::-webkit-meter-optimum-value,
    &::-webkit-meter-suboptimum-value,
    &::-webkit-meter-even-less-good-value {
      background: var(--text);
    }
    &::-moz-meter-bar {
      background: var(--text);
    }
  }
  [itemprop='reviewBody'] {
    font-size: 1.05rem;
    font-style: italic;
    &::before {
      content: '“';
    }
    &::after {
      content: '”';
    }
  }
  [itemprop='reviewBody'] + p {
    color: var(--muted);
    font-family: var(--sans);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    &::before {
      content: '— ';
    }
  }
  &[aria-busy='true'] > div {
    block-size: 4rem;
    border: 1px solid var(--text);
    background: var(--placeholder);
    animation: shimmer 2.4s linear infinite;
  }
`;
