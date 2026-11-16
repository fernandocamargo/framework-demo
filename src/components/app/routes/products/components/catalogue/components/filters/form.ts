// The search's text. It is the address's: the field starts from it, and is seeded again whenever
// the address changes it, by the back button or by its own search. Its own search changes the
// address to the text it holds, trimmed, so the field stays where it is, with the focus.

import type { Props } from './props';

export const seed = (_: undefined, { q }: Props) => ({ q });
