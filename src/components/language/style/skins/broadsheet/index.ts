import { css } from 'framework';

import rules from '../default';

export default css`
  ${rules}
  &::after {
    margin-inline-start: 0.15rem;
    inline-size: 1rem;
    block-size: 1rem;
  }
  select {
    min-inline-size: 7.5rem;
    min-block-size: 2.3rem;
    padding-inline: 1.5rem 0.15rem;
    border: 0;
    border-block-end: 1.5px solid var(--text);
    border-radius: 0;
    background: transparent;
    font-family: var(--sans);
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    &:hover {
      border-color: var(--accent);
    }
    &:focus-visible {
      box-shadow: 0 1.5px 0 var(--accent);
    }
  }
  @supports (appearance: base-select) and selector(::picker(select)) {
    select::picker(select) {
      border: 1.5px solid var(--text);
      border-radius: 0;
    }
    option {
      border-radius: 0;
      font-family: var(--serif);
      font-size: 1rem;
      letter-spacing: 0;
      text-transform: none;
      &:hover,
      &:focus {
        background: var(--text);
        color: var(--surface);
      }
    }
  }
`;
