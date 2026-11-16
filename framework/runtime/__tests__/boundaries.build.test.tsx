// The boundaries as a build composes them: no dev server, so nothing follows a folder's edits, and
// a folder with no boundary file has nothing around its element.

import { cases } from './boundaries.cases';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));
vi.mock('../hot', () => ({ HOT: false }));

cases('build');
