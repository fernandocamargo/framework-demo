import type { ReactNode } from 'react';

import type { I18n, Message } from '../i18n-types';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expect = <_ extends true>(): void => undefined;

const messages = {
  bare: () => 'x',
  computed: (values: { n: number }) => `${values.n}`,
  empty: { actions: { clear: 'Clear the filters' }, title: 'Nothing matches' },
  found: '{count, plural, =0 {No products} one {# product} other {# products}}',
  kind: '{kind, select, new {New} edited {Edited} other {}}',
  matching: '{count, plural, one {# product matching “{q}”} other {# products matching “{q}”}}',
  price: '{amount, number, ::currency/USD}',
  rich: 'Only <b>admins</b> delete, {name}',
  title: 'Products',
  updated: 'Updated {at, date, medium} by {who}',
} as const;
type Shape = I18n<{ default: typeof messages }>;

expect<Equal<Shape['title'], string>>();
expect<Equal<Parameters<Shape['found']>[0], { count: number }>>();
expect<Equal<Parameters<Shape['matching']>[0], { count: number; q: number | string }>>();
expect<Equal<Parameters<Shape['price']>[0], { amount: number }>>();
expect<Equal<Parameters<Shape['updated']>[0], { at: Date | number; who: number | string }>>();
expect<Equal<Parameters<Shape['kind']>[0], { kind: string }>>();
expect<Equal<Parameters<Shape['rich']>[0], { b: (chunks: ReactNode[]) => ReactNode; name: number | string }>>();
expect<Equal<ReturnType<Shape['rich']>, ReactNode>>();
expect<Equal<ReturnType<Shape['found']>, string>>();
expect<Equal<Shape['empty']['actions']['clear'], string>>();
expect<Equal<Shape['computed'], (values: { n: number }) => string>>();
expect<Equal<Shape['bare'], () => string>>();
expect<Equal<Message<string>, string>>();
