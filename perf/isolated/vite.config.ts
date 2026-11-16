import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  // Keep compiled dependencies out of the repository's source checks without changing their config.
  build: { emptyOutDir: true, minify: false, outDir: 'node_modules/.vite/dist' },
  plugins: [react()],
  resolve: { alias: [{ find: /^react-dom\/client$/, replacement: 'react-dom/profiling' }] },
  root: path.resolve(import.meta.dirname),
});
