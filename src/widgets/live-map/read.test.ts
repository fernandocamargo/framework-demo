import { features, read } from './read';

const item = (code: string, name: string, count: number, place?: [number, number], current = false) => `
  <li itemscope itemtype="https://schema.org/Observation">
    <a href="#/orders?region=${code}"${current ? ' aria-current="true"' : ''}>
      <span itemprop="observationAbout" itemscope itemtype="https://schema.org/State">
        <abbr itemprop="alternateName" title="${name}">${code}</abbr>
        <meta content="${name}" itemprop="name" />
        ${
          place
            ? `<span itemprop="geo" itemscope itemtype="https://schema.org/GeoCoordinates">
                 <meta content="${place[0]}" itemprop="latitude" />
                 <meta content="${place[1]}" itemprop="longitude" />
               </span>`
            : ''
        }
      </span>
      <data itemprop="value" value="${count}">${count}</data>
    </a>
  </li>`;

const figure = (...items: string[]) => {
  const element = document.createElement('figure');
  element.innerHTML = `<figcaption>Orders by state</figcaption><ol>${items.join('')}</ol>`;
  return element;
};

test('every observation with a place is read, its coordinates as numbers', () => {
  const read_ = read(figure(item('TX', 'Texas', 3, [31.05, -97.56]), item('CA', 'California', 0, [36.12, -119.68])));
  expect(
    read_.map(({ code, count, latitude, longitude, name }) => ({ code, count, latitude, longitude, name })),
  ).toEqual([
    { code: 'TX', count: 3, latitude: 31.05, longitude: -97.56, name: 'Texas' },
    { code: 'CA', count: 0, latitude: 36.12, longitude: -119.68, name: 'California' },
  ]);
  expect(typeof read_[0]?.latitude).toBe('number');
});

test('an observation without coordinates is skipped', () => {
  const read_ = read(figure(item('TX', 'Texas', 3, [31.05, -97.56]), item('??', 'Unknown', 2)));
  expect(read_.map(({ code }) => code)).toEqual(['TX']);
});

test('the state selected is the one whose link has aria-current, and its link is kept', () => {
  const element = figure(item('TX', 'Texas', 3, [31.05, -97.56], true), item('CA', 'California', 1, [36.12, -119.68]));
  const read_ = read(element);
  expect(read_.map(({ current }) => current)).toEqual([true, false]);
  expect(read_[0]?.link).toBe(element.querySelector('a'));
});

test('the observations become points, longitude first, with what the circles need', () => {
  const collection = features(read(figure(item('TX', 'Texas', 3, [31.05, -97.56], true))));
  expect(collection).toEqual({
    features: [
      {
        geometry: { coordinates: [-97.56, 31.05], type: 'Point' },
        properties: { code: 'TX', count: 3, current: true, name: 'Texas' },
        type: 'Feature',
      },
    ],
    type: 'FeatureCollection',
  });
});
