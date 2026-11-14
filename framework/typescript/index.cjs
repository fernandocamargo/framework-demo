// The framework's tsserver plugin. Editors that run
// the project's TypeScript load it from tsconfig.json:
//   "plugins": [{ "name": "framework-typescript-plugin", "root": "." }]
// `root` is the framework's root folder, relative to the tsconfig.json; `runtime` names the
// module the injected types come from (default `framework`).
//
// It changes what the language service reads, not the files: each layer file is seen with its
// injected arguments annotated (transform.cjs). Its version also changes when the annotation
// would, for example when a service is added or a component gains an async.ts.
//
// tsserver turns the editor's lines and columns into positions in the file as the editor has
// it, but the language service works on the annotated text. So the plugin maps positions on
// the way in, and spans on the way out, for the requests an editor makes most: errors, hovers,
// completions, definitions, references, renames, signature help, highlights and semantic
// colouring. Requests not listed here still see annotated positions after an annotation.
//
// tsserver loads a plugin once for the whole editor window, from the first place it finds it.
// With several clones of a repository in one window (one per ticket), that one copy would type
// them all, whatever framework version each clone's branch has. So the copy tsserver loaded
// hands each project to the project's own copy, the one its node_modules resolves from its
// tsconfig's folder, and serves the project itself only when that copy is this one, or none.
const { realpathSync } = require('node:fs');
const path = require('node:path');

const { createMapping, createTransformer } = require('./transform.cjs');

const PACKAGE = 'framework-typescript-plugin';
const self = realpathSync(__filename);

/** The project's own copy of this plugin, if it has one and it is not this one. */
function ownCopy(project) {
  try {
    const found = require.resolve(PACKAGE, { paths: [path.dirname(project)] });
    return realpathSync(found) === self ? null : realpathSync(found);
  } catch {
    return null;
  }
}

function init(modules) {
  const { typescript: ts } = modules;
  const copies = new Map();

  function create(info) {
    const project = info.project.getProjectName();
    const own = ownCopy(project);
    if (!own) return serve(info);
    let copy = copies.get(own);
    if (!copy) {
      copy = require(own)(modules);
      copies.set(own, copy);
    }
    info.project.projectService.logger.info(
      `[framework] ${project}: handed to the project's own copy of the plugin, ${own}`,
    );
    return copy.create(info);
  }

  function serve(info) {
    const config = info.config ?? {};
    const project = info.project.getProjectName();
    const root = path.resolve(path.dirname(project), config.root ?? '.');
    const transformer = createTransformer(ts, { root, runtime: config.runtime ?? 'framework' });
    const log = (message) => info.project.projectService.logger.info(`[framework] ${message}`);
    const host = info.languageServiceHost;
    const getScriptSnapshot = host.getScriptSnapshot.bind(host);
    const getScriptVersion = host.getScriptVersion?.bind(host);

    // The latest transform of each layer file, by the version it was made from.
    const cache = new Map();
    const transformed = (fileName) => {
      const snapshot = getScriptSnapshot(fileName);
      if (!snapshot) return null;
      const version = `${getScriptVersion ? getScriptVersion(fileName) : ''}:${transformer.signature(fileName)}`;
      const cached = cache.get(fileName);
      if (cached && cached.version === version) return cached;
      const result = transformer.transform(fileName, snapshot.getText(0, snapshot.getLength()));
      const entry = {
        version,
        ...result,
        mapping: createMapping(result.insertions),
        snapshot: ts.ScriptSnapshot.fromString(result.text),
      };
      cache.set(fileName, entry);
      return entry;
    };

    host.getScriptSnapshot = (fileName) => {
      if (!transformer.isLayer(fileName)) return getScriptSnapshot(fileName);
      const entry = transformed(fileName);
      return entry ? (entry.insertions.length ? entry.snapshot : getScriptSnapshot(fileName)) : undefined;
    };
    if (getScriptVersion) {
      host.getScriptVersion = (fileName) => {
        const version = getScriptVersion(fileName);
        return transformer.isLayer(fileName) ? `${version}:${transformer.signature(fileName)}` : version;
      };
    }

    // Position mapping.
    const mappingOf = (fileName) => {
      if (!fileName || !transformer.isLayer(fileName)) return null;
      const entry = transformed(fileName);
      return entry && entry.insertions.length ? entry.mapping : null;
    };
    const toSeen = (fileName, position) => mappingOf(fileName)?.toSeen(position) ?? position;
    const span = (fileName, textSpan) => {
      const mapping = mappingOf(fileName);
      if (!mapping || !textSpan) return textSpan;
      const start = mapping.toOriginal(textSpan.start);
      return { length: Math.max(0, mapping.toOriginal(textSpan.start + textSpan.length) - start), start };
    };
    const withSpans = (item, fileName = item?.fileName) => {
      if (!item) return item;
      const out = { ...item };
      for (const key of [
        'textSpan',
        'contextSpan',
        'triggerSpan',
        'applicableSpan',
        'replacementSpan',
        'optionalReplacementSpan',
      ]) {
        if (out[key]) out[key] = span(fileName, out[key]);
      }
      return out;
    };
    const diagnostic = (item) => {
      const fileName = item.file?.fileName;
      const mapping = mappingOf(fileName);
      const out = { ...item };
      if (mapping && item.start !== undefined) {
        const mapped = span(fileName, { length: item.length ?? 0, start: item.start });
        out.start = mapped.start;
        out.length = mapped.length;
      }
      if (item.relatedInformation) out.relatedInformation = item.relatedInformation.map(diagnostic);
      return out;
    };
    const definitions = (list) => list?.map((item) => withSpans(item));

    const service = info.languageService;
    const proxy = Object.create(null);
    for (const key of Object.keys(service)) {
      const value = service[key];
      proxy[key] = typeof value === 'function' ? value.bind(service) : value;
    }

    proxy.getSemanticDiagnostics = (fileName) => service.getSemanticDiagnostics(fileName).map(diagnostic);
    proxy.getSyntacticDiagnostics = (fileName) => service.getSyntacticDiagnostics(fileName).map(diagnostic);
    proxy.getSuggestionDiagnostics = (fileName) => service.getSuggestionDiagnostics(fileName).map(diagnostic);
    proxy.getQuickInfoAtPosition = (fileName, position, ...rest) =>
      withSpans(service.getQuickInfoAtPosition(fileName, toSeen(fileName, position), ...rest), fileName);
    proxy.getCompletionsAtPosition = (fileName, position, ...rest) => {
      const result = service.getCompletionsAtPosition(fileName, toSeen(fileName, position), ...rest);
      if (!result) return result;
      return { ...withSpans(result, fileName), entries: result.entries.map((entry) => withSpans(entry, fileName)) };
    };
    proxy.getCompletionEntryDetails = (fileName, position, ...rest) =>
      service.getCompletionEntryDetails(fileName, toSeen(fileName, position), ...rest);
    proxy.getDefinitionAtPosition = (fileName, position, ...rest) =>
      definitions(service.getDefinitionAtPosition(fileName, toSeen(fileName, position), ...rest));
    proxy.getDefinitionAndBoundSpan = (fileName, position, ...rest) => {
      const result = service.getDefinitionAndBoundSpan(fileName, toSeen(fileName, position), ...rest);
      return result && { definitions: definitions(result.definitions), textSpan: span(fileName, result.textSpan) };
    };
    proxy.getTypeDefinitionAtPosition = (fileName, position, ...rest) =>
      definitions(service.getTypeDefinitionAtPosition(fileName, toSeen(fileName, position), ...rest));
    proxy.getImplementationAtPosition = (fileName, position, ...rest) =>
      definitions(service.getImplementationAtPosition(fileName, toSeen(fileName, position), ...rest));
    proxy.getReferencesAtPosition = (fileName, position, ...rest) =>
      definitions(service.getReferencesAtPosition(fileName, toSeen(fileName, position), ...rest));
    proxy.findReferences = (fileName, position, ...rest) =>
      service.findReferences(fileName, toSeen(fileName, position), ...rest)?.map((symbol) => ({
        ...symbol,
        definition: withSpans(symbol.definition),
        references: definitions(symbol.references),
      }));
    proxy.getRenameInfo = (fileName, position, ...rest) =>
      withSpans(service.getRenameInfo(fileName, toSeen(fileName, position), ...rest), fileName);
    proxy.findRenameLocations = (fileName, position, ...rest) =>
      definitions(service.findRenameLocations(fileName, toSeen(fileName, position), ...rest));
    proxy.getSignatureHelpItems = (fileName, position, ...rest) =>
      withSpans(service.getSignatureHelpItems(fileName, toSeen(fileName, position), ...rest), fileName);
    proxy.getDocumentHighlights = (fileName, position, ...rest) =>
      service.getDocumentHighlights(fileName, toSeen(fileName, position), ...rest)?.map((file) => ({
        ...file,
        highlightSpans: file.highlightSpans.map((item) => withSpans(item, file.fileName)),
      }));
    const classifications =
      (method) =>
      (fileName, textSpan, ...rest) => {
        const mapping = mappingOf(fileName);
        if (!mapping) return service[method](fileName, textSpan, ...rest);
        const start = mapping.toSeen(textSpan.start);
        const result = service[method](
          fileName,
          { length: mapping.toSeen(textSpan.start + textSpan.length) - start, start },
          ...rest,
        );
        const spans = [];
        for (let index = 0; index < result.spans.length; index += 3) {
          const mapped = span(fileName, { length: result.spans[index + 1], start: result.spans[index] });
          if (mapped.length) spans.push(mapped.start, mapped.length, result.spans[index + 2]);
        }
        return { ...result, spans };
      };
    proxy.getEncodedSemanticClassifications = classifications('getEncodedSemanticClassifications');
    proxy.getEncodedSyntacticClassifications = classifications('getEncodedSyntacticClassifications');

    log(`typing injected arguments under ${root}, with ${self}`);
    return proxy;
  }

  return { create };
}

module.exports = init;
