// The boundaries as the dev server composes them: Vitest runs the dev runtime.

import { cases } from './boundaries.cases';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

cases('dev');
