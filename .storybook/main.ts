// Storybook for every component folder below src/components. Nobody writes a story: the framework
// writes one file per folder (framework/storybook/stories.mjs), with the folder's files, what the
// framework knows of them, and a story per example and per state, and writes them again while
// Storybook runs, as folders and files come and go.

import type { StorybookConfig } from '@storybook/react-vite'
import { resolveStoriesOptions, storiesPlugin, writeStories } from '../framework/storybook/stories.mjs'
import options from './stories.mjs'

const stories = resolveStoriesOptions(options)
writeStories(stories)

export default {
  framework: '@storybook/react-vite',
  stories: ['../framework-stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs'],
  viteFinal: (config) => ({ ...config, plugins: [...(config.plugins ?? []), storiesPlugin(stories)] }),
} satisfies StorybookConfig
