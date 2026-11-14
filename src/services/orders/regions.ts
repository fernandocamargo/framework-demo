// Orders by state: the count and the value of the orders each state receives. Pure: no framework,
// no client. The states' centres are approximate, for a map of tiles or of circles.

import type { Order } from './types';

export type Region = { code: string; lat: number; lng: number; name: string };

export const REGIONS: Region[] = [
  { code: 'AL', lat: 32.8, lng: -86.79, name: 'Alabama' },
  { code: 'AK', lat: 61.37, lng: -152.4, name: 'Alaska' },
  { code: 'AZ', lat: 33.73, lng: -111.43, name: 'Arizona' },
  { code: 'AR', lat: 34.97, lng: -92.37, name: 'Arkansas' },
  { code: 'CA', lat: 36.12, lng: -119.68, name: 'California' },
  { code: 'CO', lat: 39.06, lng: -105.31, name: 'Colorado' },
  { code: 'CT', lat: 41.6, lng: -72.76, name: 'Connecticut' },
  { code: 'DE', lat: 39.32, lng: -75.51, name: 'Delaware' },
  { code: 'DC', lat: 38.91, lng: -77.02, name: 'District of Columbia' },
  { code: 'FL', lat: 27.77, lng: -81.69, name: 'Florida' },
  { code: 'GA', lat: 33.04, lng: -83.64, name: 'Georgia' },
  { code: 'HI', lat: 21.09, lng: -157.5, name: 'Hawaii' },
  { code: 'ID', lat: 44.24, lng: -114.48, name: 'Idaho' },
  { code: 'IL', lat: 40.35, lng: -88.99, name: 'Illinois' },
  { code: 'IN', lat: 39.85, lng: -86.26, name: 'Indiana' },
  { code: 'IA', lat: 42.01, lng: -93.21, name: 'Iowa' },
  { code: 'KS', lat: 38.53, lng: -96.73, name: 'Kansas' },
  { code: 'KY', lat: 37.67, lng: -84.67, name: 'Kentucky' },
  { code: 'LA', lat: 31.17, lng: -91.87, name: 'Louisiana' },
  { code: 'ME', lat: 44.69, lng: -69.38, name: 'Maine' },
  { code: 'MD', lat: 39.06, lng: -76.8, name: 'Maryland' },
  { code: 'MA', lat: 42.23, lng: -71.53, name: 'Massachusetts' },
  { code: 'MI', lat: 43.33, lng: -84.54, name: 'Michigan' },
  { code: 'MN', lat: 45.69, lng: -93.9, name: 'Minnesota' },
  { code: 'MS', lat: 32.74, lng: -89.68, name: 'Mississippi' },
  { code: 'MO', lat: 38.46, lng: -92.29, name: 'Missouri' },
  { code: 'MT', lat: 46.92, lng: -110.45, name: 'Montana' },
  { code: 'NE', lat: 41.13, lng: -98.27, name: 'Nebraska' },
  { code: 'NV', lat: 38.31, lng: -117.06, name: 'Nevada' },
  { code: 'NH', lat: 43.45, lng: -71.56, name: 'New Hampshire' },
  { code: 'NJ', lat: 40.3, lng: -74.52, name: 'New Jersey' },
  { code: 'NM', lat: 34.84, lng: -106.25, name: 'New Mexico' },
  { code: 'NY', lat: 42.17, lng: -74.95, name: 'New York' },
  { code: 'NC', lat: 35.63, lng: -79.81, name: 'North Carolina' },
  { code: 'ND', lat: 47.53, lng: -99.78, name: 'North Dakota' },
  { code: 'OH', lat: 40.39, lng: -82.76, name: 'Ohio' },
  { code: 'OK', lat: 35.57, lng: -96.93, name: 'Oklahoma' },
  { code: 'OR', lat: 44.57, lng: -122.07, name: 'Oregon' },
  { code: 'PA', lat: 40.59, lng: -77.21, name: 'Pennsylvania' },
  { code: 'RI', lat: 41.68, lng: -71.51, name: 'Rhode Island' },
  { code: 'SC', lat: 33.86, lng: -80.95, name: 'South Carolina' },
  { code: 'SD', lat: 44.3, lng: -99.44, name: 'South Dakota' },
  { code: 'TN', lat: 35.75, lng: -86.69, name: 'Tennessee' },
  { code: 'TX', lat: 31.05, lng: -97.56, name: 'Texas' },
  { code: 'UT', lat: 40.15, lng: -111.86, name: 'Utah' },
  { code: 'VT', lat: 44.05, lng: -72.71, name: 'Vermont' },
  { code: 'VA', lat: 37.77, lng: -78.17, name: 'Virginia' },
  { code: 'WA', lat: 47.4, lng: -121.49, name: 'Washington' },
  { code: 'WV', lat: 38.49, lng: -80.95, name: 'West Virginia' },
  { code: 'WI', lat: 44.27, lng: -89.62, name: 'Wisconsin' },
  { code: 'WY', lat: 42.76, lng: -107.3, name: 'Wyoming' },
];

/** The code of an order that ships to no state in REGIONS. */
export const UNKNOWN = '??';

export type Tally = {
  code: string;
  lat: null | number;
  lng: null | number;
  name: string;
  /** How many orders go there. */
  orders: number;
  /** The sum of the orders' totals. */
  value: number;
};

const regionOf = (order: Order) => order.customer.address.region;

/** One entry per state, in REGIONS' order, and a last `??` entry when some order ships elsewhere. */
export const byRegion = (orders: Order[]): Tally[] => {
  const tallies = new Map<string, Tally>(
    REGIONS.map(({ code, lat, lng, name }) => [code, { code, lat, lng, name, orders: 0, value: 0 }]),
  );
  const unknown: Tally = { code: UNKNOWN, lat: null, lng: null, name: 'Unknown', orders: 0, value: 0 };
  for (const order of orders) {
    const tally = tallies.get(regionOf(order)) ?? unknown;
    tally.orders += 1;
    tally.value = Math.round((tally.value + order.total) * 100) / 100;
  }
  const known = REGIONS.map(({ code }) => tallies.get(code)!);
  return unknown.orders > 0 ? [...known, unknown] : known;
};

/** The orders that ship to one state; all of them for ''. */
export const inRegion = (orders: Order[], code: string): Order[] =>
  code === '' ? orders : orders.filter((order) => regionOf(order) === code);
