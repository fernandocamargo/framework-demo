import type { Plugin } from 'vite';

export type StoriesOptions = { cwd: string; docs: string; out: string; root: string; skip: string[] };
export function resolveStoriesOptions(options: {
  cwd?: string;
  out?: string;
  root: string;
  skip?: string[];
}): StoriesOptions;
export function writeStories(options: StoriesOptions): number;
export function storiesPlugin(options: StoriesOptions): Plugin;
export function chartStates(file: string): { description: string | undefined; path: string }[];
export function exampleNames(file: null | string): string[];
