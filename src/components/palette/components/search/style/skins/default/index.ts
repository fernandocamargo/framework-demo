import { css } from 'framework';

// In the gallery the search stands alone; the live dialog uses its shell's selectors.
export default css`
  & {
    display: block;
    max-inline-size: 36rem;
    margin: 2rem auto;
    padding: 1rem;
    background: var(--surface-2);
    color: var(--text);
  }
  & input {
    inline-size: 100%;
    padding: 0.6rem 0.8rem;
  }
  & [role='menu'] {
    max-block-size: 60vh;
    overflow: auto;
  }
  & [role='menuitem'] {
    padding: 0.4rem 0.6rem;
  }
`;
