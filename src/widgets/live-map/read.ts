// What the live map knows of the orders: only what the figure's schema.org items say, read the way a
// search engine would. No MapLibre in here, so a test can run it on a hand-made DOM.

import type { Feature, FeatureCollection, Point } from 'geojson';

export type Observation = {
  code: string;
  count: number;
  /** Whether the state is the one selected (its link has `aria-current`). */
  current: boolean;
  latitude: number;
  /** The tile's link: a click on the map is a click on it. */
  link: HTMLAnchorElement | null;
  longitude: number;
  name: string;
};

const number = (text: null | string | undefined) => {
  if (text === null || text === undefined || text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

const property = (item: Element, name: string) => item.querySelector(`[itemprop='${name}']`);
const content = (element: Element | null) => element?.getAttribute('content') ?? element?.textContent ?? null;

/** Every observation of a state under the figure that has a place; the others cannot be drawn. */
export function read(figure: ParentNode): Observation[] {
  const observations: Observation[] = [];
  for (const item of figure.querySelectorAll("[itemtype$='/Observation']")) {
    const latitude = number(content(property(item, 'latitude')));
    const longitude = number(content(property(item, 'longitude')));
    if (latitude === null || longitude === null) continue;
    const value = property(item, 'value');
    const link = item.querySelector<HTMLAnchorElement>('a');
    observations.push({
      code: property(item, 'alternateName')?.textContent?.trim() ?? '',
      count: number(value?.getAttribute('value') ?? value?.textContent) ?? 0,
      current: link?.hasAttribute('aria-current') ?? false,
      latitude,
      link,
      longitude,
      name: content(property(item, 'name'))?.trim() ?? '',
    });
  }
  return observations;
}

export type Properties = { code: string; count: number; current: boolean; name: string };

/** The observations as points, for a GeoJSON source. */
export function features(observations: Observation[]): FeatureCollection<Point, Properties> {
  return {
    features: observations.map(({ code, count, current, latitude, longitude, name }): Feature<Point, Properties> => ({
      geometry: { coordinates: [longitude, latitude], type: 'Point' },
      properties: { code, count, current, name },
      type: 'Feature',
    })),
    type: 'FeatureCollection',
  };
}
