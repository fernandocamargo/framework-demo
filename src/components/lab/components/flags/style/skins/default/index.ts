import { css } from 'framework'

export default css`
  display: grid;
  gap: 0.9rem;
  align-content: start;
  font-size: 0.87rem;
  .intro,
  .value {
    color: var(--muted);
  }
  .react-aria-RadioGroup {
    display: grid;
    gap: 0.3rem;
    padding-block-start: 0.6rem;
    border-block-start: 1px solid var(--border);
  }
  code {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.8rem;
  }
`
