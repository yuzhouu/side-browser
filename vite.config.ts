import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));

export default defineConfig({
  root: path('./src'),
  publicDir: path('./public'),
  base: './',
  build: {
    outDir: path('./dist'),
    // The build driver cleans once; the classic-script builds share this directory.
    emptyOutDir: false,
    target: 'chrome145',
    sourcemap: false,
    modulePreload: false,
    rolldownOptions: {
      input: {
        sidepanel: path('./src/sidepanel.html'),
        options: path('./src/options.html'),
        help: path('./src/help.html'),
        background: path('./src/background.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
