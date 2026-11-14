import { css } from 'framework';

// The states gallery as a photo page: each frame a plate, captioned.
export default css`
  & {
    max-inline-size: 80rem;
    margin-inline: auto;
    padding: 2rem 1.25rem 4rem;
  }
  & > header {
    margin-block-end: 2rem;
    padding-block-end: 1rem;
    border-block-end: 4px double var(--text);
    h1 {
      margin-block: 0.75rem 0.5rem;
      font-size: 3rem;
      line-height: 1;
    }
    p {
      max-inline-size: 48rem;
      font-size: 1.1rem;
      font-style: italic;
    }
  }
  section + section {
    margin-block-start: 2.5rem;
  }
  h2 {
    padding-block-start: 0.4rem;
    border-block-start: 4px solid var(--text);
    font-size: 1rem;
    small {
      margin-inline-start: 0.5rem;
      color: var(--muted);
      font-weight: 400;
    }
  }
  section > p {
    margin-block: 0.25rem 1rem;
    font-style: italic;
  }
  section > ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, 360px);
    gap: 1.5rem;
  }
  figure > div {
    inline-size: 360px;
    block-size: 300px;
    border: 1px solid var(--text);
    box-shadow: 5px 5px 0 var(--text);
    overflow: hidden;
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
    margin-block-start: 0.75rem;
    font-size: 0.88rem;
    strong {
      font-family: var(--mono);
      font-size: 0.8rem;
    }
    small {
      justify-self: start;
      color: var(--accent);
      font-family: var(--sans);
      font-size: 0.66rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    span {
      font-style: italic;
    }
  }
`;
