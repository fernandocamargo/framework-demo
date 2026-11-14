import { css } from 'framework';

// The flags as notices in the classifieds: each a name in bold, its key in type, how it is served.
export default css`
  display: grid;
  gap: 0.9rem;
  align-content: start;
  font-size: 0.9rem;
  & > p {
    font-style: italic;
  }
  [itemtype='https://schema.org/PropertyValue'] {
    display: grid;
    gap: 0.3rem;
    padding-block-start: 0.6rem;
    border-block-start: 1px dotted var(--text);
  }
  [itemprop='name'] {
    font-weight: 700;
  }
  [itemprop='value'] {
    font-style: italic;
  }
  .react-aria-RadioGroup {
    gap: 0.3rem 0.9rem;
  }
  code {
    font-size: 0.76rem;
  }
  &[aria-busy='true'] > div {
    block-size: 3.6rem;
    border: 1px solid var(--text);
    background: var(--placeholder);
    animation: shimmer 2.4s linear infinite;
  }
`;
