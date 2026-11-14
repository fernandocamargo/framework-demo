import { css } from 'framework';

export default css`
  & {
    display: grid;
    grid-template-columns: 3.5rem minmax(0, 1fr) 11rem 3.5rem 6rem auto;
    grid-template-areas: 'picture name stock rating price commands';
    align-items: center;
    gap: 0.9rem;
    padding: 0.6rem 0.9rem;
    transition: background 120ms var(--ease);
  }
  & + & {
    border-block-start: 1px solid var(--border);
  }
  &:hover {
    background: color-mix(in srgb, var(--surface-2) 50%, transparent);
  }
  /* A product with no picture shows where one would be. */
  & > img,
  &:not(:has(> img))::before {
    grid-area: picture;
    inline-size: 3.5rem;
    block-size: 3.5rem;
    border-radius: var(--radius-s);
    background: var(--surface-2);
    object-fit: cover;
  }
  &:not(:has(> img))::before {
    content: '';
  }
  hgroup {
    grid-area: name;
    min-inline-size: 0;
    h3 {
      font-size: inherit;
    }
    .react-aria-Link {
      color: var(--text);
      font-weight: 600;
    }
    p {
      color: var(--muted);
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  [itemprop='additionalProperty'],
  [itemprop='inventoryLevel'] {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  /* Changed in this browser. */
  [itemprop='additionalProperty'] {
    margin-inline-start: 0.5rem;
    background: var(--accent-soft);
    color: var(--accent);
  }
  /* The offer's parts take their own places in the row. */
  [itemprop='offers'] {
    display: contents;
    > div {
      grid-area: stock;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/InStock']) [itemprop='inventoryLevel'] {
    background: var(--ok-soft);
    color: var(--ok);
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/LimitedAvailability'])
    [itemprop='inventoryLevel'] {
    background: var(--warn-soft);
    color: var(--warn);
  }
  [itemprop='offers']:has([itemprop='availability'][href='https://schema.org/OutOfStock']) [itemprop='inventoryLevel'] {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .react-aria-Group {
    display: inline-flex;
    .react-aria-Button {
      inline-size: 1.6rem;
      min-block-size: 1.6rem;
      padding: 0;
      border-color: transparent;
      background: transparent;
      color: var(--muted);
      font-weight: 600;
      &[data-hovered] {
        background: var(--surface-2);
        color: var(--text);
      }
    }
    /* The count shows at once; the buttons say a write is on its way. */
    &[aria-busy='true'] .react-aria-Button {
      color: var(--accent);
    }
  }
  [itemprop='aggregateRating'] {
    grid-area: rating;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    &::before {
      color: var(--warn);
    }
  }
  [itemprop='price'] {
    grid-area: price;
    justify-self: end;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  /* The commands on a product are their glyphs; their names stay for assistive technology. */
  menu {
    grid-area: commands;
    display: flex;
    > li:empty {
      display: none;
    }
    .react-aria-Link {
      inline-size: 2.4rem;
      padding: 0;
      border-color: transparent;
      background: transparent;
      color: var(--muted);
      &[data-hovered] {
        background: var(--surface-2);
        color: var(--text);
      }
    }
    [itemprop='name'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
  @media (max-width: 44rem) {
    & {
      grid-template-columns: 3.5rem minmax(0, 1fr) auto;
      grid-template-areas:
        'picture name price'
        'picture stock commands';
      row-gap: 0.25rem;
    }
    & > img,
    &:not(:has(> img))::before {
      align-self: start;
    }
    [itemprop='aggregateRating'] {
      display: none;
    }
    menu {
      justify-self: end;
    }
  }
`;
