import { css } from 'framework';

// The tour as a card in the bottom-left corner, over the page and its dialogs, clear of the lab's
// panel, which docks at the right.
export default css`
  &:is(aside) {
    position: fixed;
    inset: auto auto 1rem 1rem;
    z-index: 41;
    display: grid;
    gap: 0.6rem;
    inline-size: min(24rem, calc(100vw - 2rem));
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    animation: rise 200ms var(--ease);
  }
  &:is(aside) > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    h2 {
      font-size: 0.95rem;
    }
  }
  h3 {
    font-size: 1.05rem;
  }
  [itemprop='text'] {
    color: var(--muted);
    font-size: 0.92rem;
  }
  progress {
    inline-size: 100%;
    accent-color: var(--accent);
  }
  [role='alert'] {
    color: var(--danger);
    font-size: 0.9rem;
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
  }
`;
