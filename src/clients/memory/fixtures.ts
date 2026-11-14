// The memory world's data: a small catalogue in DummyJSON's shapes, and its one user. Written
// by rule, so every run starts from the same shop.

import type { Product } from '@/services/products/types';

// Its order matters: a product's id comes from its category's place here (desks are 31 to 40).
const CATALOGUE = {
  audio: [
    'Studio Monitor',
    'Desk Microphone',
    'Open-Back Headphones',
    'Audio Interface',
    'Boom Arm',
    'Pop Filter',
    'Bluetooth Speaker',
    'Noise-Cancelling Earbuds',
    'Podcast Mixer',
  ],
  keyboards: [
    'Tenkeyless Keyboard',
    'Split Keyboard',
    'Low-Profile Keyboard',
    'Numeric Pad',
    'Walnut Wrist Rest',
    'PBT Keycap Set',
    'Linear Switch Pack',
    'Coiled Cable',
    'Macro Pad',
  ],
  lighting: [
    'Monitor Light Bar',
    'Arc Floor Lamp',
    'Task Lamp',
    'Bias Light Strip',
    'Key Light',
    'Ring Light',
    'Smart Bulb Pair',
    'Clamp Lamp',
    'Paper Lantern',
  ],
  desks: [
    'Standing Desk',
    'Oak Desk Shelf',
    'Monitor Arm',
    'Cable Tray',
    'Felt Desk Mat',
    'Laptop Stand',
    'Drawer Unit',
    'Footrest',
    'Pegboard Panel',
    'Headphone Hook',
  ],
} as const;

const BRANDS = ['Northlight', 'Quiet Hours', 'Fieldwork', 'Mono & Co', 'Tandem'];
const REVIEWERS = ['Ada Okafor', 'Jun Tanaka', 'Mira Costa', 'Theo Lindqvist', 'Sana Rahman', 'Luca Moretti'];
const COMMENTS = [
  'Does what it says, and well.',
  'Solid build, quick delivery.',
  'Good, though the manual is thin.',
  'Better than the one it replaced.',
  'Fine for the price.',
  'Would buy again.',
];
const HUES = { audio: 262, desks: 150, keyboards: 198, lighting: 38 };

/** A picture for a product with no network: the start of its name on its category's colour. */
const picture = (title: string, hue: number, shade: number) => {
  const initials = title.slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="hsl(${hue} 45% ${shade}%)"/><text x="48" y="58" font-family="system-ui,sans-serif" font-size="30" font-weight="600" text-anchor="middle" fill="hsl(${hue} 60% 96%)">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const categories = Object.keys(CATALOGUE).map((slug) => ({
  name: slug[0]!.toUpperCase() + slug.slice(1),
  slug,
}));

export const products: Product[] = Object.entries(CATALOGUE).flatMap(([category, titles], group) =>
  titles.map((title, index): Product => {
    const id = group * 10 + index + 1;
    const hue = HUES[category as keyof typeof HUES];
    return {
      brand: BRANDS[id % BRANDS.length]!,
      category,
      description: `${title} for a home office. ${['Ships in two days.', 'Made to be repaired.', 'Two-year warranty.'][id % 3]}`,
      id,
      images: [picture(title, hue, 42), picture(title, hue, 30), picture(title, hue, 54)],
      price: Math.round((19 + ((id * 37) % 280) + 0.99) * 100) / 100,
      rating: Math.round((3.2 + ((id * 7) % 18) / 10) * 10) / 10,
      reviews: [0, 1, 2].map((offset) => ({
        comment: COMMENTS[(id + offset * 2) % COMMENTS.length]!,
        date: `2026-0${1 + ((id + offset) % 9)}-1${offset}T10:00:00.000Z`,
        rating: 3 + ((id + offset) % 3),
        reviewerName: REVIEWERS[(id + offset) % REVIEWERS.length]!,
      })),
      // Every seventh product is out of stock, and every fifth is low.
      stock: id % 7 === 0 ? 0 : id % 5 === 0 ? 4 : 12 + ((id * 13) % 80),
      thumbnail: picture(title, hue, 42),
      title,
    };
  }),
);

/**
 * The memory world's users: one per role DummyJSON gives its users, with the same ids, names,
 * passwords and roles as DummyJSON's own (users 1, 6 and 16).
 */
export const users = [
  {
    email: 'emily.johnson@x.dummyjson.com',
    firstName: 'Emily',
    id: 1,
    image: picture('Emily Johnson', 330, 45),
    lastName: 'Johnson',
    password: 'emilyspass',
    role: 'admin',
    username: 'emilys',
  },
  {
    email: 'olivia.wilson@x.dummyjson.com',
    firstName: 'Olivia',
    id: 6,
    image: picture('Olivia Wilson', 200, 45),
    lastName: 'Wilson',
    password: 'oliviawpass',
    role: 'moderator',
    username: 'oliviaw',
  },
  {
    email: 'avery.perez@x.dummyjson.com',
    firstName: 'Avery',
    id: 16,
    image: picture('Avery Perez', 150, 45),
    lastName: 'Perez',
    password: 'averyppass',
    role: 'user',
    username: 'averyp',
  },
];

// The memory world's customers and orders. Twelve states, each with two customers in a city of
// that state, and forty carts of the catalogue's products: DummyJSON's users and carts, by rule.
const STATES = [
  { city: 'Austin', code: 'TX', lat: 30.27, lng: -97.74, postalCode: '78701', state: 'Texas' },
  { city: 'Albany', code: 'NY', lat: 42.65, lng: -73.76, postalCode: '12207', state: 'New York' },
  { city: 'Tampa', code: 'FL', lat: 27.95, lng: -82.46, postalCode: '33602', state: 'Florida' },
  { city: 'Chicago', code: 'IL', lat: 41.88, lng: -87.63, postalCode: '60601', state: 'Illinois' },
  { city: 'Seattle', code: 'WA', lat: 47.61, lng: -122.33, postalCode: '98101', state: 'Washington' },
  { city: 'Denver', code: 'CO', lat: 39.74, lng: -104.99, postalCode: '80202', state: 'Colorado' },
  { city: 'Atlanta', code: 'GA', lat: 33.75, lng: -84.39, postalCode: '30303', state: 'Georgia' },
  { city: 'Boston', code: 'MA', lat: 42.36, lng: -71.06, postalCode: '02108', state: 'Massachusetts' },
  { city: 'Portland', code: 'OR', lat: 45.52, lng: -122.68, postalCode: '97201', state: 'Oregon' },
  { city: 'Tucson', code: 'AZ', lat: 32.22, lng: -110.97, postalCode: '85701', state: 'Arizona' },
  { city: 'Duluth', code: 'MN', lat: 46.79, lng: -92.1, postalCode: '55802', state: 'Minnesota' },
  { city: 'Provo', code: 'UT', lat: 40.23, lng: -111.66, postalCode: '84601', state: 'Utah' },
];
const FIRST_NAMES = [
  'Amara',
  'Bruno',
  'Clara',
  'Diego',
  'Elena',
  'Felix',
  'Gina',
  'Hugo',
  'Ines',
  'Jonas',
  'Kira',
  'Leo',
];
const LAST_NAMES = [
  'Alves',
  'Brooks',
  'Chen',
  'Dubois',
  'Evans',
  'Fischer',
  'Garcia',
  'Hayes',
  'Ito',
  'Jensen',
  'Kowalski',
  'Lopes',
];
const STREETS = ['Main Street', 'Oak Avenue', 'Lake Road', 'Cedar Lane', 'Market Street', 'River Drive'];

const cents = (value: number) => Math.round(value * 100) / 100;

/** Customer n (0 to 23) lives in state n % 12, so each state has two. Ids 101 to 124. */
export const customers = Array.from({ length: 24 }, (_, index) => {
  const place = STATES[index % STATES.length]!;
  return {
    address: {
      address: `${100 + index * 17} ${STREETS[index % STREETS.length]}`,
      city: place.city,
      coordinates: { lat: place.lat, lng: place.lng },
      country: 'United States',
      postalCode: String(Number(place.postalCode) + Math.floor(index / STATES.length)).padStart(5, '0'),
      state: place.state,
      stateCode: place.code,
    },
    firstName: FIRST_NAMES[index % FIRST_NAMES.length]!,
    id: 101 + index,
    lastName: LAST_NAMES[(index * 5) % LAST_NAMES.length]!,
  };
});

/** Cart k (1 to 40) holds 1 to 3 products, 1 to 4 of each, at 5% off; its customer is 101 + (7k % 24). */
export const carts = Array.from({ length: 40 }, (_, index) => {
  const k = index + 1;
  const lines = Array.from({ length: 1 + (k % 3) }, (_, offset) => {
    const product = products[(k * 5 + offset * 11) % products.length]!;
    const quantity = 1 + ((k + offset) % 4);
    const total = cents(product.price * quantity);
    return {
      discountedTotal: cents(total * 0.95),
      discountPercentage: 5,
      id: product.id,
      price: product.price,
      quantity,
      thumbnail: product.thumbnail,
      title: product.title,
      total,
    };
  });
  return {
    discountedTotal: cents(lines.reduce((sum, line) => sum + line.discountedTotal, 0)),
    id: k,
    products: lines,
    total: cents(lines.reduce((sum, line) => sum + line.total, 0)),
    totalProducts: lines.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    userId: 101 + ((k * 7) % 24),
  };
});
