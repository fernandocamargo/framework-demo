import { css } from 'framework';

// The tour as a boxed notice in the newspaper's manner, in the bottom-left corner.
export default css`
  &:is(aside) {
    position: fixed;
    inset: auto auto 1rem 1rem;
    z-index: 41;
    display: grid;
    gap: 0.7rem;
    inline-size: min(24rem, calc(100vw - 2rem));
    padding: 0.9rem 1rem;
    border: 3px double var(--text);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  &:is(aside) > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block-end: 0.4rem;
    border-block-end: 1px solid var(--text);
    h2 {
      font-family: var(--sans);
      font-size: 0.78rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
  }
  h3 {
    font-family: var(--serif);
    font-size: 1.25rem;
  }
  [itemprop='text'] {
    font-family: var(--serif);
    font-style: italic;
    font-size: 0.95rem;
  }
  progress {
    inline-size: 100%;
    accent-color: var(--text);
  }
  [role='alert'] {
    color: var(--accent);
    font-weight: 700;
  }
  &:is(aside) > menu {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    li {
      list-style: none;
    }
    .react-aria-Button {
      min-block-size: 1.9rem;
      padding: 0 0.5rem;
      font-size: 0.64rem;
    }
  }
`;
