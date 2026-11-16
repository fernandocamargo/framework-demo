/**
 * Whether a dev server is serving the page: it sends a folder's files again as they are edited.
 * In a file of its own so a test can run the runtime as a build composes it.
 */
export const HOT = Boolean((import.meta as { hot?: unknown }).hot);
