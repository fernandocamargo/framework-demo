import { css } from 'framework'

export default css`
  > .react-aria-Button {
    border-color: transparent;
    background: transparent;
    &[data-hovered] {
      background: var(--surface-2);
    }
    &[data-active] {
      background: var(--warn-soft);
      color: var(--warn);
    }
  }
  .count {
    display: grid;
    place-items: center;
    min-inline-size: 1.3rem;
    block-size: 1.3rem;
    border-radius: 1rem;
    background: var(--warn);
    color: var(--surface);
    font-size: 0.78rem;
  }
  /* Docked beside the page on a wide screen (the app's skin makes room for it), a sheet at the
     bottom on a narrow one. render.tsx puts it at the end of the page, with this component's
     class, so these rules reach it. */
  &.panel {
    position: fixed;
    inset: var(--header) 0 0 auto;
    z-index: 30;
    display: grid;
    grid-template-rows: auto auto auto auto minmax(12rem, 1fr);
    gap: 0.9rem;
    inline-size: var(--lab);
    padding: 1rem;
    border-inline-start: 1px solid var(--border);
    background: var(--surface);
    overflow: auto;
  }
  @media (max-width: 64rem) {
    &.panel {
      inset: auto 0.5rem 0.5rem;
      inline-size: auto;
      max-block-size: 60dvh;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      animation: rise 200ms var(--ease);
    }
  }
  &.panel > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    h2 {
      font-size: 1.05rem;
    }
  }
  .intro {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .controls {
    display: grid;
    gap: 0.9rem;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    .react-aria-Button {
      min-block-size: 2rem;
      padding: 0 0.6rem;
      font-size: 0.87rem;
    }
  }
  .log {
    display: grid;
    gap: 0.35rem;
    align-content: start;
    overflow: auto;
    font-size: 0.82rem;
    li {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      align-items: baseline;
      gap: 0.4rem;
      overflow-wrap: anywhere;
    }
    time {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    small {
      color: var(--muted);
    }
    .none {
      display: block;
      color: var(--muted);
    }
  }
  @media (max-width: 44rem) {
    .text {
      display: none;
    }
  }
`
