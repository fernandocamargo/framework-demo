import { css } from 'framework'

// Two elements carry this component's class: the widget in the header, and the sign-in dialog's
// modal, which renders in a portal (marked "dialog").
export default css`
  &:not(.dialog) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.5rem;
    line-height: 1.2;
    img {
      border-radius: 50%;
      background: var(--surface-2);
    }
    div {
      display: grid;
    }
    strong {
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
  }
  .token {
    color: var(--muted);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    &[data-refreshing] {
      color: var(--accent);
    }
  }
  form {
    display: grid;
    gap: 0.75rem;
  }
  .accounts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
    margin-block-start: 0.25rem;
  }
  .hint {
    color: var(--muted);
    font-size: 0.9rem;
    code {
      padding: 0.05rem 0.3rem;
      border-radius: 4px;
      background: var(--surface-2);
      color: var(--text);
    }
    .react-aria-Link {
      border: 0;
      background: none;
      padding: 0;
      color: var(--accent);
      font: inherit;
      cursor: pointer;
      &[data-hovered] {
        text-decoration: underline;
      }
    }
  }
  @media (max-width: 36rem) {
    .who div {
      display: none;
    }
  }
`
