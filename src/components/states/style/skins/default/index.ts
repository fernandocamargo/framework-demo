import { css } from 'framework';

// Each frame is the page at 720 × 600, shown at half its size: a picture of the state.
export default css`
  & {
    max-inline-size: 76rem;
    margin-inline: auto;
    padding: 2rem 1.25rem 4rem;
  }
  & > header {
    margin-block-end: 2rem;
    h1 {
      margin-block: 0.75rem 0.5rem;
    }
    p {
      color: var(--muted);
      max-inline-size: 48rem;
    }
  }
  section + section {
    margin-block-start: 2.5rem;
  }
  h2 {
    font-size: 1rem;
    small {
      color: var(--muted);
      font-weight: 400;
      margin-inline-start: 0.5rem;
    }
  }
  section > p {
    color: var(--muted);
    margin-block: 0.25rem 1rem;
  }
  section > ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, 360px);
    gap: 1.25rem;
    padding: 0;
    list-style: none;
  }
  figure {
    margin: 0;
  }
  figure > div {
    inline-size: 360px;
    block-size: 300px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
  }
  iframe {
    inline-size: 720px;
    block-size: 600px;
    border: 0;
    transform: scale(0.5);
    transform-origin: 0 0;
    pointer-events: none;
  }
  figcaption {
    display: grid;
    gap: 0.2rem;
    margin-block-start: 0.5rem;
    font-size: 0.88rem;
    span {
      color: var(--muted);
    }
    small {
      justify-self: start;
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: var(--surface-2);
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 600;
    }
  }
`;
