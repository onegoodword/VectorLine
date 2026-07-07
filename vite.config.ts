import { defineConfig } from 'vite';

// base is set from BASE_PATH for GitHub Pages project sites
// (e.g. BASE_PATH=/VectorLine/); defaults to root for local dev.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
