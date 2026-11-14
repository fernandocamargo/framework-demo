// The maps: where a basemap's style is.

export const style =
  ({ clients: { maps } }) =>
  async () =>
    maps.style();
