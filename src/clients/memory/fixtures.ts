// The memory world's data: a small catalogue in DummyJSON's shapes, and its one user. Written
// by rule, so every run starts from the same shop.
import type { Product } from '@/services/products/types'

const CATALOGUE = {
  audio: ['Studio Monitor', 'Desk Microphone', 'Open-Back Headphones', 'Audio Interface', 'Boom Arm', 'Pop Filter', 'Bluetooth Speaker', 'Noise-Cancelling Earbuds', 'Podcast Mixer'],
  keyboards: ['Tenkeyless Keyboard', 'Split Keyboard', 'Low-Profile Keyboard', 'Numeric Pad', 'Walnut Wrist Rest', 'PBT Keycap Set', 'Linear Switch Pack', 'Coiled Cable', 'Macro Pad'],
  lighting: ['Monitor Light Bar', 'Arc Floor Lamp', 'Task Lamp', 'Bias Light Strip', 'Key Light', 'Ring Light', 'Smart Bulb Pair', 'Clamp Lamp', 'Paper Lantern'],
  desks: ['Standing Desk', 'Oak Desk Shelf', 'Monitor Arm', 'Cable Tray', 'Felt Desk Mat', 'Laptop Stand', 'Drawer Unit', 'Footrest', 'Pegboard Panel', 'Headphone Hook'],
} as const

const BRANDS = ['Northlight', 'Quiet Hours', 'Fieldwork', 'Mono & Co', 'Tandem']
const REVIEWERS = ['Ada Okafor', 'Jun Tanaka', 'Mira Costa', 'Theo Lindqvist', 'Sana Rahman', 'Luca Moretti']
const COMMENTS = ['Does what it says, and well.', 'Solid build, quick delivery.', 'Good, though the manual is thin.', 'Better than the one it replaced.', 'Fine for the price.', 'Would buy again.']
const HUES = { audio: 262, keyboards: 198, lighting: 38, desks: 150 }

/** A picture for a product with no network: the start of its name on its category's colour. */
const picture = (title: string, hue: number, shade: number) => {
  const initials = title.slice(0, 2).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="hsl(${hue} 45% ${shade}%)"/><text x="48" y="58" font-family="system-ui,sans-serif" font-size="30" font-weight="600" text-anchor="middle" fill="hsl(${hue} 60% 96%)">${initials}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const categories = Object.keys(CATALOGUE).map((slug) => ({ slug, name: slug[0]!.toUpperCase() + slug.slice(1) }))

export const products: Product[] = Object.entries(CATALOGUE).flatMap(([category, titles], group) =>
  titles.map((title, index): Product => {
    const id = group * 10 + index + 1
    const hue = HUES[category as keyof typeof HUES]
    return {
      id,
      title,
      description: `${title} for a home office. ${['Ships in two days.', 'Made to be repaired.', 'Two-year warranty.'][id % 3]}`,
      category,
      brand: BRANDS[id % BRANDS.length]!,
      price: Math.round((19 + ((id * 37) % 280) + 0.99) * 100) / 100,
      // Every seventh product is out of stock, and every fifth is low.
      stock: id % 7 === 0 ? 0 : id % 5 === 0 ? 4 : 12 + ((id * 13) % 80),
      rating: Math.round((3.2 + ((id * 7) % 18) / 10) * 10) / 10,
      thumbnail: picture(title, hue, 42),
      images: [picture(title, hue, 42), picture(title, hue, 30), picture(title, hue, 54)],
      reviews: [0, 1, 2].map((offset) => ({
        rating: 3 + ((id + offset) % 3),
        comment: COMMENTS[(id + offset * 2) % COMMENTS.length]!,
        date: `2026-0${1 + ((id + offset) % 9)}-1${offset}T10:00:00.000Z`,
        reviewerName: REVIEWERS[(id + offset) % REVIEWERS.length]!,
      })),
    }
  }),
)

/**
 * The memory world's users: one per role DummyJSON gives its users, with the same ids, names,
 * passwords and roles as DummyJSON's own (users 1, 6 and 16).
 */
export const users = [
  { id: 1, username: 'emilys', password: 'emilyspass', firstName: 'Emily', lastName: 'Johnson', email: 'emily.johnson@x.dummyjson.com', role: 'admin', image: picture('Emily Johnson', 330, 45) },
  { id: 6, username: 'oliviaw', password: 'oliviawpass', firstName: 'Olivia', lastName: 'Wilson', email: 'olivia.wilson@x.dummyjson.com', role: 'moderator', image: picture('Olivia Wilson', 200, 45) },
  { id: 16, username: 'averyp', password: 'averyppass', firstName: 'Avery', lastName: 'Perez', email: 'avery.perez@x.dummyjson.com', role: 'user', image: picture('Avery Perez', 150, 45) },
]
