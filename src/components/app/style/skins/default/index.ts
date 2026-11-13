import { css } from 'framework'
import Lab from '@/components/lab'

export default css`
  & {
    display: grid;
    grid-template-rows: var(--header) auto 1fr;
    min-block-size: 100dvh;
  }
  /* While the network lab is open on a wide screen, the page leaves it its column. */
  @media (min-width: 64.01rem) {
    :root:has(${Lab}.panel) & > main {
      margin-inline-end: var(--lab);
      inline-size: min(72rem, calc(100% - var(--lab)));
    }
  }
  .skip {
    position: absolute;
    inset: 0.5rem auto auto 0.5rem;
    z-index: 30;
    &:not([data-focus-visible]) {
      clip-path: inset(50%);
      inline-size: 1px;
      block-size: 1px;
      min-block-size: 0;
      padding: 0;
      overflow: hidden;
    }
  }
  > header {
    position: sticky;
    inset-block-start: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 clamp(0.75rem, 3vw, 2rem);
    border-block-end: 1px solid var(--border);
    /* No filter or transform here: the network lab's panel, inside this header, is fixed to the viewport. */
    background: var(--surface);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-inline-end: auto;
    min-inline-size: 0;
    h1 {
      font-size: 1.05rem;
      letter-spacing: -0.01em;
    }
  }
  .mark {
    inline-size: 1.6rem;
    block-size: 1.6rem;
    border-radius: 7px;
    background:
      linear-gradient(var(--on-accent) 0 0) 50% 34% / 55% 2px no-repeat,
      linear-gradient(var(--on-accent) 0 0) 50% 50% / 55% 2px no-repeat,
      linear-gradient(var(--on-accent) 0 0) 34% 66% / 35% 2px no-repeat,
      var(--accent);
  }
  .progress {
    block-size: 2px;
    overflow: hidden;
    &[data-active]::before {
      content: '';
      display: block;
      block-size: 100%;
      inline-size: 40%;
      background: var(--accent);
      animation: travel 900ms var(--ease) infinite;
    }
  }
  > main {
    inline-size: min(72rem, 100%);
    margin-inline: auto;
    padding: clamp(1rem, 3vw, 2rem) clamp(0.75rem, 3vw, 2rem) 6rem;
  }
  @media (max-width: 30rem) {
    .brand .badge {
      display: none;
    }
  }
`
