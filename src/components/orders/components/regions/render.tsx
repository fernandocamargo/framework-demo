import { Link } from 'react-aria-components';

// The states as a map of tiles, in markup: each one an observation of a state's orders, placed by
// the skin (style/tiles.ts). Its fill is a meter: the count as a three-step choropleth, with no script.
// With the live map on, `ref` hands the figure to widgets/live-map, which reads these same items.
export default ({ caption, className, label, map, max, tiles }) => (
  <figure className={className} ref={map}>
    <figcaption>{caption}</figcaption>
    <ol aria-label={label}>
      {tiles.map((tile) => (
        <li itemScope itemType="https://schema.org/Observation" key={tile.code}>
          <Link aria-current={tile.current ? 'true' : undefined} aria-label={tile.label} href={tile.href}>
            <span itemProp="observationAbout" itemScope itemType="https://schema.org/State">
              <abbr itemProp="alternateName" title={tile.name}>
                {tile.code}
              </abbr>
              <meta content={tile.name} itemProp="name" />
              {tile.lat !== null && tile.lng !== null && (
                <span itemProp="geo" itemScope itemType="https://schema.org/GeoCoordinates">
                  <meta content={String(tile.lat)} itemProp="latitude" />
                  <meta content={String(tile.lng)} itemProp="longitude" />
                </span>
              )}
            </span>
            <data itemProp="value" value={tile.count}>
              {tile.count}
            </data>
            <meter high={(2 * max) / 3} low={max / 3} max={max} min={0} optimum={max} value={tile.count} />
          </Link>
        </li>
      ))}
    </ol>
  </figure>
);
