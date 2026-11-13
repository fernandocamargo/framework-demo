/**
 * The i18n layer: a component folder's `i18n.ts` and its translations.
 *
 * - `i18n.ts` default-exports an object of any shape. Its leaves are ICU messages, in the
 *   source language, or functions.
 * - Translations live beside it, in `i18n/<locale>.json`: flat objects keyed by the folder's
 *   path and the message's path (`"components/catalogue/empty/title": "Nada encontrado"`), each
 *   loaded on demand, the first time a component of that folder shows in that locale.
 * - The component gets `i18n`, the same shape: a message with no arguments is its string; one
 *   with arguments or tags is a function of their values (`i18n.found({ count })`); a function
 *   leaf is called with the values and the locale's `intl`.
 * - `intl` is react-intl's, one per locale, for anything the messages do not cover
 *   (`intl.formatNumber`, `intl.formatList`, `intl.formatRelativeTime`).
 *
 * The messages of a folder in a locale are built once and shared by every instance, so a
 * component's `i18n` keeps its identity until the locale changes.
 */
import { createContext } from 'react'
import { createIntl, createIntlCache, type IntlShape } from 'react-intl'
import { parse } from '@formatjs/icu-messageformat-parser'
import { hold } from './activity'
import { tracked } from './thenable'

/** The language `i18n.ts` files are written in. */
export const SOURCE_LOCALE = 'en'

/** What a component folder's generated module carries about its messages. */
export type MessagesSpec = {
  path: string
  i18n?: { default?: unknown }
  translations?: Record<string, () => Promise<{ default: Record<string, string> }>>
}

/** The locale being shown. Only components that read it subscribe, so the others never re-render for it. */
export const LocaleContext = createContext<string>(SOURCE_LOCALE)

let active = SOURCE_LOCALE
/** The locale `Root` shows, for loads started outside a render (a view's children preloading). */
export const activeLocale = () => active
export const activateLocale = (locale: string) => {
  active = locale
}

const cache = createIntlCache()
/** Per locale, every message of the folders loaded so far, by id. react-intl reads it at call time. */
const catalogs = new Map<string, Record<string, string>>()
const intls = new Map<string, IntlShape>()

/** react-intl's `intl` for a locale: one per locale, so it keeps its identity. */
export function intlFor(locale: string): IntlShape {
  let intl = intls.get(locale)
  if (!intl) {
    const messages: Record<string, string> = {}
    catalogs.set(locale, messages)
    intl = createIntl({ locale, defaultLocale: SOURCE_LOCALE, messages }, cache)
    intls.set(locale, intl)
  }
  return intl
}

/** Whether an ICU message takes values: an argument, a plural, a tag. */
const takesValues = (message: string) => parse(message).some((element) => element.type !== 0)

type Tree = { [key: string]: unknown }

/** A folder's messages, built at once from its translations: what `loadMessages` resolves to. */
export function build(spec: MessagesSpec, translated: Record<string, string>, intl: IntlShape): Tree {
  const catalog = catalogs.get(intl.locale) ?? {}
  const walk = (node: Tree, at: string[]): Tree =>
    Object.fromEntries(
      Object.entries(node).map(([key, value]) => {
        const id = `${spec.path}/${[...at, key].join('/')}`
        if (typeof value === 'function') return [key, (values?: unknown) => (value as (values: unknown, intl: IntlShape) => unknown)(values, intl)]
        if (value && typeof value === 'object') return [key, walk(value as Tree, [...at, key])]
        const source = String(value)
        catalog[id] = translated[id] ?? source
        // Whether a message is a string or a function of values is the source's, as its type is.
        return [key, takesValues(source) ? (values?: Record<string, unknown>) => intl.formatMessage({ id, defaultMessage: source }, values as never) : intl.formatMessage({ id, defaultMessage: source })]
      }),
    )
  return walk((spec.i18n?.default ?? {}) as Tree, [])
}

const loaded = new Map<string, Promise<Tree>>()

/** The folders with messages that have a component on screen, each with how many. */
const shown = new Map<MessagesSpec, number>()

/** Counts a folder's component as on screen, until the returned function is called. */
export function showing(spec: MessagesSpec): () => void {
  shown.set(spec, (shown.get(spec) ?? 0) + 1)
  return () => {
    const count = (shown.get(spec) ?? 1) - 1
    if (count > 0) shown.set(spec, count)
    else shown.delete(spec)
  }
}

/**
 * The messages, in a locale, of every folder with a component on screen. `Root` waits for them
 * before it shows the locale, so the change happens in one commit and no component suspends.
 */
export const loadShown = (locale: string) => Promise.all([...shown.keys()].map((spec) => loadMessages(spec, locale)))

/**
 * A folder's messages in a locale, built once: `pt-BR` reads `i18n/pt-BR.json`, or `i18n/pt.json`
 * when there is no file for the region; the source locale, or one with no file, shows the source.
 * Counted as pending for `whenIdle()` while its file loads.
 */
export function loadMessages(spec: MessagesSpec, locale: string): Promise<Tree> {
  const key = `${spec.path}\0${locale}`
  let messages = loaded.get(key)
  if (!messages) {
    const language = locale.split('-')[0] ?? locale
    const file = locale === SOURCE_LOCALE ? undefined : (spec.translations?.[locale] ?? spec.translations?.[language])
    messages = tracked(hold((file ? file().then((module) => module.default) : Promise.resolve({})).then((translated) => build(spec, translated, intlFor(locale)))))
    loaded.set(key, messages)
  }
  return messages
}
