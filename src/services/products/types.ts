// The catalogue's shapes. `Product` is DummyJSON's; the rest is what the services answer.

export type SortKey = 'title' | 'price' | 'rating' | 'stock'

export type Review = { rating: number; comment: string; date: string; reviewerName: string }

/** A product as the API has it. */
export type Product = {
  id: number
  title: string
  description: string
  category: string
  brand?: string
  price: number
  stock: number
  rating: number
  thumbnail: string
  images: string[]
  reviews: Review[]
}

/** What the local overlay adds to a product: its version, and whether this browser changed it. */
export type Local = { version: number; local?: 'edited' | 'created' }

/** A product in a list. */
export type Listed = Omit<Product, 'images' | 'reviews'> & Local
/** A product on its own. */
export type Detailed = Omit<Product, 'reviews'> & Local

export type Category = { slug: string; name: string }

export type Query = { q: string; category: string; sort: SortKey; order: 'asc' | 'desc'; page: number }

export type Page = { items: Listed[]; total: number; page: number; pages: number }

/** The fields a person edits. */
export type Changes = Pick<Product, 'title' | 'description' | 'category' | 'price' | 'stock'> & { brand: string }
