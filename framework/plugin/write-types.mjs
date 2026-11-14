// Writes the component folders' declarations without starting Vite, so `tsc` can run alone:
//   node framework/plugin/write-types.mjs --root src --runtime framework/runtime/index.ts

import { parseArgs } from 'node:util'
import { resolveOptions, writeTypes } from './index.mjs'

const { values } = parseArgs({ options: { root: { type: 'string' }, runtime: { type: 'string' }, types: { type: 'string' } } })

if (!values.root || !values.runtime) {
  console.error('Usage: write-types.mjs --root <folder> --runtime <file> [--types <folder>]')
  process.exit(2)
}

writeTypes(resolveOptions({ root: values.root, runtime: values.runtime, ...(values.types ? { types: values.types } : {}) }))
