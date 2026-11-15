import Lab from '@/components/lab';
import { css } from 'framework';

// The page as a newspaper's front: a masthead over a double rule, the tools above it in small
// type, and the page set in a wide column.
export default css`
  & {
    display: grid;
    /* One column, never wider than the page: the header's row of pages scrolls inside it. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    min-block-size: 100dvh;
  }
  @media (min-width: 64.01rem) {
    :root:has(aside${Lab}) & > main {
      margin-inline-end: var(--lab);
      inline-size: min(80rem, calc(100% - var(--lab)));
    }
  }
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
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem 0.5rem;
    inline-size: min(80rem, 100%);
    margin-inline: auto;
    padding: 0.5rem clamp(1rem, 4vw, 3rem) 0;
    border-block-end: 4px double var(--text);
  }
  /* The masthead takes a line of its own, under the tools. */
  > header hgroup {
    order: 99;
    flex-basis: 100%;
    display: grid;
    justify-items: center;
    gap: 0.35rem;
    padding-block: 0.75rem 0.6rem;
    border-block-start: 1px solid var(--text);
    text-align: center;
    h1 {
      font-family: 'Old English Text MT', 'Blackmoor LET', 'UnifrakturMaguntia', var(--serif);
      font-size: clamp(2.8rem, 8vw, 5.6rem);
      font-weight: 400;
      letter-spacing: 0.01em;
      line-height: 1;
    }
  }
  /* The world the page reads, set as the edition line. */
  > header [itemprop='isBasedOn'] {
    padding: 0.15rem 2.5rem;
    border-block: 1px solid var(--text);
    font-family: var(--sans);
    font-size: 0.68rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
  }
  > header nav .react-aria-Link {
    min-block-size: 0;
    padding: 0 0.25rem;
    border: 0;
    background: none;
    text-decoration: underline;
    &[data-hovered] {
      background: none;
      color: var(--accent);
    }
    /* The page the address shows, underlined twice. */
    &[aria-current='page'] {
      background: none;
      text-decoration: underline double;
    }
  }
  /* While the page changes address, a line sweeps under the masthead. */
  &[aria-busy='true'] > header::after {
    content: '';
    position: absolute;
    inset: auto 0 -4px;
    block-size: 3px;
    background: linear-gradient(var(--accent) 0 0) 0 0 / 30% 100% no-repeat;
    animation: sweep 900ms var(--ease) infinite;
  }
  > main {
    inline-size: min(80rem, 100%);
    margin-inline: auto;
    padding: 1.5rem clamp(1rem, 4vw, 3rem) 6rem;
  }
`;
