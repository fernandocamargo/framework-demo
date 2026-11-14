// A component folder's page in Storybook: what the folder holds, what the framework knows of each
// file (what its functions are given, and which sources the component follows because of it),
// the states of its chart, its stories, and each file's source. The story files hold all of it
// (stories.mjs); this page only shows it.

import { Primary, Source, Stories, Title, useOf } from '@storybook/addon-docs/blocks'

type Folder = {
  path: string
  reads: { all: string[]; byLayer: Record<string, string[]>; names: Record<string, string[]> }
  states: { path: string; description?: string }[]
  files: { name: string; layer: string }[]
  sources: string[]
}

/** Each layer file's job, in the framework's words (README.md). */
const JOBS: Record<string, string> = {
  render: 'What the person sees: markup and interpolation, no logic and no hooks.',
  props: 'What a parent passes (`Props`), and what the render gets, worked out by a pure function.',
  async: 'What it reads before it shows (the default export), and the operations it may run.',
  state: 'Its flow, as a statechart. Checks and changes are exported pure functions.',
  form: 'Its fields: server data in, a request out, and what is wrong with them.',
  acl: 'Whether what it offers may be done: a boolean for it and everything below it.',
  i18n: 'Its words, in English. Translations sit beside it, checked key by key.',
  shortcuts: 'The keys it answers while it is on screen.',
  placeholder: 'What shows while it waits for its view, its skin or its read.',
  error: 'What shows when it fails, with a way to try again.',
  module: 'A helper of the folder.',
  test: 'Its rules, tested without React.',
  skin: 'How it looks: plain CSS nested under its class.',
  translation: 'Its words in another locale.',
}

const language = (name: string) => (name.endsWith('.json') ? 'json' : 'tsx')
const list = (values: string[] | undefined) => (values?.length ? values.join(', ') : '—')

export function FolderDocs() {
  const resolved = useOf('meta') as unknown as { preparedMeta: { parameters: { framework: Folder } } }
  const folder = resolved.preparedMeta.parameters.framework
  const layerOf = (file: { name: string; layer: string }) => (file.layer === 'state' ? 'state' : file.layer)
  return (
    <>
      <Title />
      <p>
        The folder <code>{folder.path}</code>: {folder.files.length} files. It follows {list(folder.reads.all)}
        {folder.reads.all.length ? ', and nothing else: a change of anything else renders nothing here.' : ': no source of the framework.'}
      </p>
      <h2>Files</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Its job</th>
            <th>Given</th>
            <th>Follows</th>
          </tr>
        </thead>
        <tbody>
          {folder.files.map((file) => (
            <tr key={file.name}>
              <td>
                <code>{file.name}</code>
              </td>
              <td>{JOBS[file.layer] ?? ''}</td>
              <td>{list(folder.reads.names[layerOf(file)])}</td>
              <td>{list(folder.reads.byLayer[layerOf(file)])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {folder.states.length > 0 && (
        <>
          <h2>States</h2>
          <p>Each is a story below, the component held in that state, with its chart never started.</p>
          <ul>
            {folder.states.map((state) => (
              <li key={state.path}>
                <code>{state.path}</code>
                {state.description ? `: ${state.description}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      <Primary />
      <Stories />
      <h2>Sources</h2>
      {folder.files.map((file, index) => (
        <section key={file.name}>
          <h3>
            <code>{file.name}</code>
          </h3>
          <Source code={folder.sources[index]} language={language(file.name)} />
        </section>
      ))}
    </>
  )
}
