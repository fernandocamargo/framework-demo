import { css } from 'framework';

// The orders page as a section of the paper: its name as a kicker over a heavy rule, the map and
// the ledger below it, and a note set in italics where the page is not for the reader.
export default css`
  & {
    display: grid;
    gap: 1.5rem;
  }
  h2 {
    font-family: var(--sans);
    font-size: 0.95rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  & > header {
    padding-block-start: 0.5rem;
    border-block-start: 5px solid var(--text);
  }
  & > p[role='note'] {
    padding: 2rem 1rem;
    border: 1px solid var(--text);
    font-size: 1.15rem;
    font-style: italic;
    a[href] {
      font-style: normal;
      text-decoration: underline;
    }
  }
`;
