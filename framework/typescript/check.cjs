#!/usr/bin/env node
// `tsc --noEmit` for a project whose injected arguments the framework types:
// a compiler host hands TypeScript each layer file as the tsserver
// plugin shows it to editors. It reads the plugin's options from the project's tsconfig.json.
//   node framework/typescript/check.cjs -p .
const path = require('node:path')
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }))
const { createTransformer, createMapping } = require('./transform.cjs')
const folders = require('../shared/folders.cjs')

const args = process.argv.slice(2)
const flag = args.findIndex((arg) => arg === '-p' || arg === '--project')
const given = flag === -1 ? process.cwd() : path.resolve(args[flag + 1])
const configPath = ts.sys.directoryExists(given) ? path.join(given, 'tsconfig.json') : given

const format = {
  getCanonicalFileName: (file) => file,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
}
const fail = (diagnostics) => {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, format))
  process.exit(1)
}

const read = ts.readConfigFile(configPath, ts.sys.readFile)
if (read.error) fail([read.error])
const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath), undefined, configPath)
if (parsed.errors.length) fail(parsed.errors)

const entry = (parsed.options.plugins ?? []).find((plugin) => plugin.name === 'framework-typescript-plugin')
if (!entry) {
  console.error(`${configPath} lists no "framework-typescript-plugin" in compilerOptions.plugins`)
  process.exit(2)
}
const root = path.resolve(path.dirname(configPath), entry.root ?? '.')
const transformer = createTransformer(ts, { root, runtime: entry.runtime ?? 'framework' })

// Convention mistakes first, each naming its file and rule.
const mistakes = folders.problems(root)
for (const problem of mistakes) console.error(`${path.relative(process.cwd(), path.join(root, problem.file))}: ${problem.message}`)

// Each layer file as TypeScript sees it, and its original, to report errors where they are.
const originals = new Map()
const host = ts.createCompilerHost(parsed.options)
const getSourceFile = host.getSourceFile.bind(host)
host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
  const source = getSourceFile(fileName, languageVersion, onError, shouldCreate)
  if (!source || !transformer.isLayer(fileName)) return source
  const { text, insertions } = transformer.transform(fileName, source.text)
  if (!insertions.length) return source
  originals.set(fileName, { source, mapping: createMapping(insertions) })
  return ts.createSourceFile(fileName, text, languageVersion, true)
}

const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, host, projectReferences: parsed.projectReferences })
const original = (diagnostic) => {
  const found = diagnostic.file && originals.get(diagnostic.file.fileName)
  if (!found || diagnostic.start === undefined) return diagnostic
  const start = found.mapping.toOriginal(diagnostic.start)
  const end = found.mapping.toOriginal(diagnostic.start + (diagnostic.length ?? 0))
  return { ...diagnostic, file: found.source, start, length: end - start, relatedInformation: diagnostic.relatedInformation?.map(original) }
}
const diagnostics = ts.getPreEmitDiagnostics(program).map(original)
if (diagnostics.length) fail(diagnostics)
if (mistakes.length) process.exit(1)
