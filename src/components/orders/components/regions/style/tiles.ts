// The places of the states on the map, shared by every skin that draws it: a grid of 11 columns and
// 8 rows, each state at its row and column, as the country lies. A tile is found by its state's
// English name, which its abbreviation carries as `title`; the unknown state flows below the grid.

import { REGIONS } from '@/services/orders/regions';
import { css } from 'framework';

const PLACES: [code: string, row: number, column: number][] = [
  ['AK', 1, 1],
  ['ME', 1, 11],
  ['VT', 2, 10],
  ['NH', 2, 11],
  ['WA', 3, 1],
  ['ID', 3, 2],
  ['MT', 3, 3],
  ['ND', 3, 4],
  ['MN', 3, 5],
  ['IL', 3, 6],
  ['WI', 3, 7],
  ['MI', 3, 8],
  ['NY', 3, 9],
  ['RI', 3, 10],
  ['MA', 3, 11],
  ['OR', 4, 1],
  ['NV', 4, 2],
  ['WY', 4, 3],
  ['SD', 4, 4],
  ['IA', 4, 5],
  ['IN', 4, 6],
  ['OH', 4, 7],
  ['PA', 4, 8],
  ['NJ', 4, 9],
  ['CT', 4, 10],
  ['CA', 5, 1],
  ['UT', 5, 2],
  ['CO', 5, 3],
  ['NE', 5, 4],
  ['MO', 5, 5],
  ['KY', 5, 6],
  ['WV', 5, 7],
  ['VA', 5, 8],
  ['MD', 5, 9],
  ['DE', 5, 10],
  ['AZ', 6, 2],
  ['NM', 6, 3],
  ['KS', 6, 4],
  ['AR', 6, 5],
  ['TN', 6, 6],
  ['NC', 6, 7],
  ['SC', 6, 8],
  ['DC', 6, 9],
  ['OK', 7, 4],
  ['LA', 7, 5],
  ['MS', 7, 6],
  ['AL', 7, 7],
  ['GA', 7, 8],
  ['HI', 8, 1],
  ['TX', 8, 4],
  ['FL', 8, 9],
];

const rules = PLACES.map(([code, row, column]) => {
  const name = REGIONS.find((region) => region.code === code)?.name ?? code;
  return `li:has([itemprop='alternateName'][title='${name}']) { grid-area: ${row} / ${column}; }`;
}).join('\n');

export default css`
  ${rules}
  li:has([itemprop='alternateName'][title='Unknown']) {
    grid-row: 9;
    grid-column: 1 / -1;
  }
`;
