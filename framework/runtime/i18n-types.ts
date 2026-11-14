/**
 * The type of a component's `i18n`, worked out from its `i18n.ts` by TypeScript alone, so it
 * follows the messages as they are typed. The TypeScript plugin reads `i18n.ts` as `as const`,
 * so each message is its literal text, and this file reads the ICU in it:
 *
 * - a message with no arguments and no tags is a `string`;
 * - one with arguments is a function of their values: `{count, plural, …}`, `{n, number}` and
 *   `{n, selectordinal, …}` take a number; `{at, date}` and `{at, time}` a `Date` or a number;
 *   `{kind, select, …}` a string; `{name}` a string or a number;
 * - one with tags (`<b>…</b>`) also takes a function per tag, and gives React nodes;
 * - a function leaf `(values, intl) => …` is called with its values alone.
 */

import type { ReactNode } from 'react';
import type { IntlShape } from 'react-intl';

type Space = ' ' | '\n' | '\r' | '\t';
type TrimStart<S extends string> = S extends `${Space}${infer Rest}` ? TrimStart<Rest> : S;
type TrimEnd<S extends string> = S extends `${infer Rest}${Space}` ? TrimEnd<Rest> : S;
type Trim<S extends string> = TrimEnd<TrimStart<S>>;

/** Reads up to the first `,` or `}`: [what was read, the delimiter, the rest]. */
type Until<S extends string, Read extends string = ''> = S extends `${infer C}${infer Rest}`
  ? C extends ',' | '}'
    ? [Trim<Read>, C, Rest]
    : Until<Rest, `${Read}${C}`>
  : [Trim<Read>, '', ''];

/** Just after a `{` that opens an option's body: [the body, what follows its closing `}`]. */
type Body<
  S extends string,
  Depth extends unknown[] = [],
  Read extends string = '',
> = S extends `${infer C}${infer Rest}`
  ? C extends '{'
    ? Body<Rest, [...Depth, 0], `${Read}{`>
    : C extends '}'
      ? Depth extends [unknown, ...infer Outer]
        ? Body<Rest, Outer, `${Read}}`>
        : [Read, Rest]
      : Body<Rest, Depth, `${Read}${C}`>
  : [Read, ''];

type ValueOf<Kind extends string> = Kind extends 'number' | 'plural' | 'selectordinal'
  ? number
  : Kind extends 'date' | 'time'
    ? Date | number
    : Kind extends 'select'
      ? string
      : number | string;

/** The arguments of an ICU message, as a union of `[name, value]`. */
type Args<S extends string> = S extends `${string}{${infer Rest}` ? Argument<Until<Rest>> : never;

type Argument<Head> = Head extends [infer Name extends string, infer Delimiter, infer Rest extends string]
  ? Delimiter extends '}'
    ? [Name, number | string] | Args<Rest>
    : Kind<Name, Until<Rest>>
  : never;

type Kind<Name extends string, Read> = Read extends [
  infer Type extends string,
  infer Delimiter,
  infer Rest extends string,
]
  ? Type extends 'plural' | 'select' | 'selectordinal'
    ? [Name, ValueOf<Type>] | Options<Rest>
    : Delimiter extends '}'
      ? [Name, ValueOf<Type>] | Args<Rest>
      : [Name, ValueOf<Type>] | Args<AfterStyle<Rest>>
  : never;

/** A number's or a date's style (`::currency/USD`, `short`) holds no braces: what follows it. */
type AfterStyle<S extends string> = S extends `${string}}${infer After}` ? After : '';

/** A plural's or a select's options, `one {…} other {…}}`: the arguments inside them and after. */
type Options<S extends string> =
  TrimStart<S> extends `}${infer After}`
    ? Args<After>
    : S extends `${string}{${infer Rest}`
      ? Body<Rest> extends [infer Inside extends string, infer After extends string]
        ? Args<Inside> | Options<After>
        : never
      : never;

/** The tags of an ICU message (`<b>`), by name. */
type Tags<S extends string> = S extends `${string}<${infer Name}>${infer Rest}`
  ? (Name extends '' | `${string} ${string}` | `/${string}` ? never : Name) | Tags<Rest>
  : never;

type Intersect<Union> = (Union extends unknown ? (value: Union) => void : never) extends (value: infer Both) => void
  ? Both
  : never;

type Shown<T> = T extends infer Members ? { [Name in keyof Members]: Members[Name] } : never;

/** Boxed, so a value that is itself a union (`string | number`) is not split by the intersection. */
type Boxes<Found, Name> = Found extends [Name, infer Value] ? { value: Value } : never;
/** An argument used twice takes a value both uses accept. */
type Values<Found extends [string, unknown]> = {
  [Name in Found[0]]: Intersect<Boxes<Found, Name>> extends { value: infer Value } ? Value : never;
};
type TagValues<Names extends string> = { [Name in Names]: (chunks: ReactNode[]) => ReactNode };

/** One message as the component gets it. */
export type Message<S> = S extends string
  ? string extends S
    ? string
    : [Args<S>] extends [never]
      ? [Tags<S>] extends [never]
        ? string
        : (values: Shown<TagValues<Tags<S>>>) => ReactNode
      : [Tags<S>] extends [never]
        ? (values: Shown<Values<Args<S>>>) => string
        : (values: Shown<TagValues<Tags<S>> & Values<Args<S>>>) => ReactNode
  : never;

/** A function leaf as the component gets it: called with its values, the locale's `intl` given by the framework. */
type FunctionLeaf<F> = F extends (values: infer Given, intl: IntlShape) => infer Result
  ? unknown extends Given
    ? () => Result
    : (values: Given) => Result
  : never;

type MessagesOf<Tree> = Shown<{
  -readonly [Key in keyof Tree]: Tree[Key] extends string
    ? Message<Tree[Key]>
    : Tree[Key] extends (...args: never[]) => unknown
      ? FunctionLeaf<Tree[Key]>
      : MessagesOf<Tree[Key]>;
}>;

/** A component's `i18n`: the shape of its `i18n.ts`, each message typed from its ICU. */
export type I18n<Module> = Module extends { default: infer Tree } ? MessagesOf<Tree> : never;

/** The `intl` a component gets: react-intl's, for the locale on screen. */
export type Intl = IntlShape;
