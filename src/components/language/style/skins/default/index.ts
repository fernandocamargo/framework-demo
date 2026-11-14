import { css } from 'framework';

export default css`
  & .react-aria-Button {
    gap: 0.4rem;
    /* Languages. */
    &::before {
      content: '';
      inline-size: 1.1rem;
      block-size: 1.1rem;
      background: currentColor;
      mask: var(--glyph-globe) center / contain no-repeat;
      -webkit-mask: var(--glyph-globe) center / contain no-repeat;
    }
  }
`;
