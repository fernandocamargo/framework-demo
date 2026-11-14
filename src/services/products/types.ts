// The catalogue's shapes. `Product` is DummyJSON's; the rest is what the services answer.

export type SortKey = 'price' | 'rating' | 'stock' | 'title';

export type Review = { comment: string; date: string; rating: number; reviewerName: string };

/** A product as the API has it. */
export type Product = {
  brand?: string;
  category: string;
  description: string;
  id: number;
  images: string[];
  price: number;
  rating: number;
  reviews: Review[];
  stock: number;
  thumbnail: string;
  title: string;
};

/** What the local overlay adds to a product: its version, and whether this browser changed it. */
export type Local = { local?: 'created' | 'edited'; version: number };

/** A product in a list. */
export type Listed = Local & Omit<Product, 'images' | 'reviews'>;
/** A product on its own. */
export type Detailed = Local & Omit<Product, 'reviews'>;

export type Category = { name: string; slug: string };

export type Query = { category: string; order: 'asc' | 'desc'; page: number; q: string; sort: SortKey };

export type Page = { items: Listed[]; page: number; pages: number; total: number };

/** The fields a person edits. */
export type Changes = Pick<Product, 'category' | 'description' | 'price' | 'stock' | 'title'> & { brand: string };
