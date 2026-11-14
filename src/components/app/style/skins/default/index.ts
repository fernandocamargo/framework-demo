import Lab from '@/components/lab';
import { css } from 'framework';

export default css`
  & {
    display: grid;
    grid-template-rows: auto 1fr;
    min-block-size: 100dvh;
  }
  /* While the network lab is open on a wide screen, the page leaves it its column. */
  @media (min-width: 64.01rem) {
    :root:has(aside${Lab}) & > main {
      margin-inline-end: var(--lab);
      inline-size: min(72rem, calc(100% - var(--lab)));
    }
  }
  /* The way past the header, for the keyboard: shown when it has the focus. */
  & > .react-aria-Button:first-child {
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
    flex-wrap: wrap;
    align-items: center;
    gap: 0 0.5rem;
    min-block-size: var(--header);
    padding: 0.45rem clamp(0.75rem, 3vw, 2rem) 0;
    border-block-end: 1px solid var(--border);
    /* No filter or transform here: the network lab's panel, inside this header, is fixed to the viewport. */
    background: var(--surface);
  }
  /* While the page changes address, a line sweeps under the header. */
  &[aria-busy='true'] > header::after {
    content: '';
    position: absolute;
    inset: auto 0 -2px;
    block-size: 2px;
    background: linear-gradient(var(--accent) 0 0) 0 0 / 40% 100% no-repeat;
    animation: sweep 900ms var(--ease) infinite;
  }
  > header hgroup {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-inline-end: auto;
    min-inline-size: 0;
    h1 {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.05rem;
      letter-spacing: -0.01em;
      /* The brand's mark. */
      &::before {
        content: '';
        inline-size: 1.6rem;
        block-size: 1.6rem;
        border-radius: 7px;
        background:
          linear-gradient(var(--on-accent) 0 0) 50% 34% / 55% 2px no-repeat,
          linear-gradient(var(--on-accent) 0 0) 50% 50% / 55% 2px no-repeat,
          linear-gradient(var(--on-accent) 0 0) 34% 66% / 35% 2px no-repeat,
          var(--accent);
      }
    }
  }
  /* The world the page reads. */
  > header [itemprop='isBasedOn'] {
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  /* The app's pages take a row of their own, under the tools: one row held them while there was
     one page, and four pages beside the tools ran wider than a laptop's screen. On a narrow
     screen the row scrolls rather than wrapping. */
  > header nav {
    order: 1;
    display: flex;
    flex: 1 0 100%;
    gap: 0.25rem;
    padding-block: 0.3rem 0.45rem;
    overflow-x: auto;
  }
  > header nav .react-aria-Link {
    flex: none;
    border-color: transparent;
    background: transparent;
    &[data-hovered] {
      background: var(--surface-2);
    }
    /* The page the address shows. */
    &[aria-current='page'] {
      background: var(--surface-2);
      font-weight: 600;
    }
  }
  > main {
    inline-size: min(72rem, 100%);
    margin-inline: auto;
    padding: clamp(1rem, 3vw, 2rem) clamp(0.75rem, 3vw, 2rem) 6rem;
  }
  /* On a phone the header's tools take several rows: it scrolls away with the page rather than
     keeping a third of the screen. */
  @media (max-width: 44rem) {
    > header {
      position: relative;
    }
  }
  @media (max-width: 30rem) {
    > header [itemprop='isBasedOn'] {
      display: none;
    }
  }
`;
