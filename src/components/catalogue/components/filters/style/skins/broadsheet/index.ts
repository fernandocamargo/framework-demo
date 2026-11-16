import { css } from 'framework';

import rules from '../default';

export default css`
  ${rules}
  & {
    gap: 0.5rem 1.5rem;
    align-items: end;
  }
  input,
  select {
    min-block-size: 2.3rem;
    padding-inline: 0.15rem;
    border: 0;
    border-block-end: 1.5px solid var(--text);
    border-radius: 0;
    background: transparent;
    font-family: var(--serif);
    &:hover {
      border-color: var(--accent);
    }
    &:focus-visible {
      border-color: var(--accent);
      box-shadow: 0 1.5px 0 var(--accent);
    }
  }
  input {
    padding-inline: 1.8rem;
    &:focus {
      box-shadow: 0 1.5px 0 var(--accent);
    }
  }
  form::before {
    inset-inline-start: 0.2rem;
    color: var(--text);
  }
  @supports (appearance: base-select) {
    select::picker(select) {
      border: 1.5px solid var(--text);
      border-radius: 0;
    }
    option {
      border-radius: 0;
      font-family: var(--serif);
      &:hover,
      &:focus {
        background: var(--text);
        color: var(--surface);
      }
    }
  }
`;
