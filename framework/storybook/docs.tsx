// A component folder's page in Storybook: what the folder holds, what the framework knows of each
// file (what its functions are given, and which sources the component follows because of it),
// the states of its chart, its stories, and each file's source. The story files hold all of it
// (stories.mjs); this page only shows it.

import { Primary, Source, Stories, Title, useOf } from '@storybook/addon-docs/blocks';

type Folder = {
  files: { layer: string; name: string }[];
  path: string;
  reads: { all: string[]; byLayer: Record<string, string[]>; names: Record<string, string[]> };
  sources: string[];
  states: { description?: string; path: string }[];
};

/** Each layer file's job, in the framework's words (README.md). */
const JOBS: Record<string, string> = {
  acl: 'Whether what it offers may be done: a boolean for it and everything below it.',
  async: 'What it reads before it shows (the default export), and the operations it may run.',
  error: 'What shows when it fails, with a way to try again.',
  form: 'Its fields: server data in, a request out, and what is wrong with them.',
  i18n: 'Its words, in English. Translations sit beside it, checked key by key.',
  module: 'A helper of the folder.',
  placeholder: 'What shows while it waits for its view, its skin or its read.',
  props: 'What a parent passes (`Props`), and what the render gets, worked out by a pure function.',
  render: 'What the person sees: markup and interpolation, no logic and no hooks.',
  shortcuts: 'The keys it answers while it is on screen.',
  skin: 'How it looks: plain CSS nested under its class.',
  state: 'Its flow, as a statechart. Checks and changes are exported pure functions.',
  test: 'Its rules, tested without React.',
  translation: 'Its words in another locale.',
};

const language = (name: string) => (name.endsWith('.json') ? 'json' : 'tsx');
const list = (values: string[] | undefined) => (values?.length ? values.join(', ') : '—');

export function FolderDocs() {
  const resolved = useOf('meta') as unknown as { preparedMeta: { parameters: { framework: Folder } } };
  const folder = resolved.preparedMeta.parameters.framework;
  const layerOf = (file: { layer: string; name: string }) => (file.layer === 'state' ? 'state' : file.layer);
  return (
    <>
      <Title />
      <p>
        The folder <code>{folder.path}</code>: {folder.files.length} files. It follows {list(folder.reads.all)}
        {folder.reads.all.length
          ? ', and nothing else: a change of anything else renders nothing here.'
          : ': no source of the framework.'}
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
  );
}
