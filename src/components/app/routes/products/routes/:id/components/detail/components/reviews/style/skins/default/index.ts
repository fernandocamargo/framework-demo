import { css } from 'framework';

export default css`
  & {
    display: grid;
    gap: 0.6rem;
    padding-block-start: 1rem;
    border-block-start: 1px solid var(--border);
  }
  h3 {
    font-size: 0.95rem;
    &::before {
      margin-inline-end: 0.35rem;
      color: var(--warn);
    }
  }
  ul {
    display: grid;
    gap: 0.75rem;
  }
  /* A review's rating, as five stars filled up to it. */
  meter {
    appearance: none;
    display: block;
    inline-size: 5.5rem;
    block-size: 1.1rem;
    border: 0;
    background: var(--border-strong);
    mask: var(--glyph-star) 0 0 / 1.1rem 1.1rem repeat-x;
    -webkit-mask: var(--glyph-star) 0 0 / 1.1rem 1.1rem repeat-x;
    &::-webkit-meter-bar {
      border: 0;
      background: var(--border-strong);
    }
    &::-webkit-meter-optimum-value,
    &::-webkit-meter-suboptimum-value,
    &::-webkit-meter-even-less-good-value {
      background: var(--warn);
    }
    &::-moz-meter-bar {
      background: var(--warn);
    }
  }
  [itemprop='reviewBody'] + p {
    color: var(--muted);
    font-size: 0.87rem;
  }
  /* While the reviews are read. */
  &[aria-busy='true'] > div {
    block-size: 3.5rem;
    border-radius: var(--radius-s);
    background: var(--placeholder);
    animation: shimmer 1.4s linear infinite;
  }
`;
