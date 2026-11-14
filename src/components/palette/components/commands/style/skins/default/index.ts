import { css } from 'framework';

// A palette in the middle of the page: a large field, quiet rows, the keys at their right.
export default css`
  & {
    max-inline-size: 36rem;
    margin-block-start: 8vh;
  }
  & search {
    margin-block-end: 0.5rem;
  }
  & input {
    inline-size: 100%;
    padding: 0.6rem 0.8rem;
    font-size: 1.1rem;
  }
  & [role='menu'] {
    max-block-size: 60vh;
    overflow: auto;
    outline: none;
  }
  & [role='group'] + [role='group'] {
    margin-block-start: 0.6rem;
  }
  & [role='group'] > header {
    padding-inline: 0.6rem;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 500;
  }
  & [role='menuitem'] {
    padding: 0.4rem 0.6rem;
    border-radius: 0.35rem;
    outline: none;
  }
  & [role='menuitem'][data-focused] {
    background: var(--surface-2);
  }
  & [role='menuitem'][data-disabled] {
    color: var(--muted);
  }
  & [role='menuitem'] > span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  & [role='menuitem'] [itemprop='name'] {
    flex: 1;
  }
  & [role='menuitem'] kbd {
    font-size: 0.8rem;
    font-weight: 600;
  }
  & small {
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
  }
`;
