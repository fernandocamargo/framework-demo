// Where the live map's basemap comes from: a MapTiler style when the build holds a key, otherwise
// OpenFreeMap's free one. The same in both worlds, since a map's tiles are no part of the shop's API.

export default ({ env }) => ({
  style: (): string =>
    env.mapsKey
      ? `https://api.maptiler.com/maps/dataviz/style.json?key=${encodeURIComponent(env.mapsKey)}`
      : 'https://tiles.openfreemap.org/styles/positron',
});
