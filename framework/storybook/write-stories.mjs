// Writes the component folders' story files without starting Storybook, so `tsc` can check them:
//   node framework/storybook/write-stories.mjs --config .storybook/stories.mjs
// The config is an ES module whose default export holds `root` and, optionally, `out` and `skip`.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveStoriesOptions, writeStories } from './stories.mjs';

const { values } = parseArgs({ options: { config: { type: 'string' } } });
if (!values.config) {
  console.error('Usage: write-stories.mjs --config <module>');
  process.exit(2);
}
const { default: config } = await import(pathToFileURL(path.resolve(values.config)).href);
console.log(`${writeStories(resolveStoriesOptions(config))} story files`);
