import { css } from 'framework';

export default css`
  display: grid;
  gap: 0.9rem;
  align-content: start;
  font-size: 0.87rem;
  & > p,
  [itemprop='value'] {
    color: var(--muted);
  }
  [itemtype='https://schema.org/PropertyValue'] {
    display: grid;
    gap: 0.3rem;
    padding-block-start: 0.6rem;
    border-block-start: 1px solid var(--border);
  }
  .react-aria-RadioGroup {
    gap: 0.3rem 0.8rem;
  }
  code {
    font-size: 0.78rem;
    color: var(--muted);
  }
  /* While the flags are read. */
  &[aria-busy='true'] > div {
    block-size: 3.6rem;
    border-radius: var(--radius-s);
    background: var(--placeholder);
    animation: shimmer 1.4s linear infinite;
    &:first-child {
      block-size: 2.4rem;
    }
  }
`;
