import { css } from 'framework';

// The catalogue as a section of the paper: its name as a kicker over a heavy rule, and its
// products set in columns, a rule between each.
export default css`
  & {
    display: grid;
    gap: 1.25rem;
  }
  & > header {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 0.75rem;
    padding-block-start: 0.5rem;
    border-block-start: 5px solid var(--text);
    h2 {
      font-family: var(--sans);
      font-size: 0.95rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    p {
      color: var(--muted);
      font-style: italic;
    }
    menu {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    a[href]:has(> [itemtype='https://schema.org/CreateAction']) {
      background: var(--text);
      color: var(--surface);
      box-shadow: 3px 3px 0 var(--accent);
    }
  }
  ul[aria-label] {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr));
    border-block-start: 1px solid var(--text);
    border-inline-start: 1px solid var(--text);
  }
  & > p:not([role]) {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    border: 1px solid var(--text);
    font-size: 1.15rem;
    font-style: italic;
  }
  nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    font-family: var(--sans);
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  &[aria-busy='true'] ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr));
    gap: 1rem;
    li {
      block-size: 20rem;
      border: 1px solid var(--text);
      background: var(--placeholder);
      animation: shimmer 2.4s linear infinite;
    }
  }
`;
