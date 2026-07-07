import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single build target: one self-contained dist/index.html. All CSS, JS,
// and the bundled demo image are inlined, so the file opens standalone
// via file:// and also deploys as-is to GitHub Pages/Netlify/any static host.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000_000,
  },
});
