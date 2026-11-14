import type { Plugin } from 'vite'

export type StoriesOptions = { cwd: string; root: string; out: string; docs: string; skip: string[] }
export function resolveStoriesOptions(options: { cwd?: string; root: string; out?: string; skip?: string[] }): StoriesOptions
export function writeStories(options: StoriesOptions): number
export function storiesPlugin(options: StoriesOptions): Plugin
export function chartStates(file: string): { path: string; description: string | undefined }[]
export function exampleNames(file: string | null): string[]
