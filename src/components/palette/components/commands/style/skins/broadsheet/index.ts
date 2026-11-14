import { css } from 'framework';

// An index card: section headers in small caps between rules, as the keyboard list's sheet does.
export default css`
  & {
    max-inline-size: 36rem;
    margin-block-start: 8vh;
  }
  & search {
    margin-block-end: 0.75rem;
    border-block-end: 1px solid var(--text);
  }
  & input {
    inline-size: 100%;
    padding: 0.4rem 0;
    border: 0;
    background: transparent;
    font-style: italic;
    font-size: 1.1rem;
  }
  & [role='menu'] {
    max-block-size: 60vh;
    overflow: auto;
    outline: none;
  }
  & [role='group'] + [role='group'] {
    margin-block-start: 1rem;
  }
  & [role='group'] > header {
    margin-block-end: 0.3rem;
    padding-block-end: 0.2rem;
    border-block-end: 1px solid var(--text);
    font-size: 0.75rem;
    font-variant: small-caps;
    letter-spacing: 0.05em;
  }
  & [role='menuitem'] {
    padding: 0.25rem 0;
    outline: none;
  }
  & [role='menuitem'][data-focused] {
    text-decoration: underline;
  }
  & [role='menuitem'][data-disabled] {
    color: var(--muted);
    text-decoration: line-through;
  }
  & [role='menuitem'] > span {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  & [role='menuitem'] [itemprop='name'] {
    flex: 1;
  }
  & [role='menuitem'] kbd {
    padding: 0 0.3rem;
    border: 1px solid currentColor;
    font-size: 0.8rem;
    font-weight: 700;
  }
  & small {
    font-style: italic;
  }
`;
