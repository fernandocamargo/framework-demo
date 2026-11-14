import { css } from 'framework';

export default css`
  & {
    display: grid;
    grid-template-columns: 3.5rem minmax(0, 1fr) 11rem 3.5rem 6rem auto;
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
  img,
  .no-picture {
    inline-size: 3.5rem;
    block-size: 3.5rem;
    border-radius: var(--radius-s);
    background: var(--surface-2);
    object-fit: cover;
  }
  .name {
    min-inline-size: 0;
    .react-aria-Link {
      color: var(--text);
      font-weight: 600;
    }
    .badge {
      margin-inline-start: 0.5rem;
    }
    p {
      color: var(--muted);
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .badge {
    justify-self: start;
  }
  .stock {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .stock .react-aria-Group {
    display: inline-flex;
  }
  /* The count shows at once; the buttons say a write is on its way. */
  .stock .react-aria-Group[data-sending] .react-aria-Button {
    color: var(--accent);
  }
  .stock .react-aria-Button {
    inline-size: 1.6rem;
    block-size: 1.6rem;
    font-weight: 600;
  }
  .rating {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    .icon {
      color: var(--warn);
    }
  }
  .price {
    justify-self: end;
    font-variant-numeric: tabular-nums;
  }
  .actions {
    display: flex;
  }
  @media (max-width: 44rem) {
    & {
      grid-template-columns: 3.5rem minmax(0, 1fr) auto;
      grid-template-areas:
        'picture name price'
        'picture stock actions';
      row-gap: 0.25rem;
    }
    img,
    .no-picture {
      grid-area: picture;
      align-self: start;
    }
    .name {
      grid-area: name;
    }
    .price {
      grid-area: price;
    }
    .stock {
      grid-area: stock;
    }
    .rating {
      display: none;
    }
    .actions {
      grid-area: actions;
      justify-self: end;
    }
  }
`;
