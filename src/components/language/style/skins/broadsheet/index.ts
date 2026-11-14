import { css } from 'framework';

export default css`
  & .react-aria-Button {
    gap: 0.35rem;
    min-inline-size: 7.5rem;
    font-family: var(--sans);
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    &::before {
      content: '';
      inline-size: 1rem;
      block-size: 1rem;
      background: currentColor;
      mask: var(--glyph-globe) center / contain no-repeat;
      -webkit-mask: var(--glyph-globe) center / contain no-repeat;
    }
  }
`;
