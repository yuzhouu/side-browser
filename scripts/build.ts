import { rm } from 'node:fs/promises';
import { watch as watchFiles } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));
const watch = process.argv.includes('--watch');
const outDir = path('../dist');
async function compile() {
  await rm(outDir, { recursive: true, force: true });
  // Chrome injects these as classic scripts. Each is a self-contained IIFE,
  // without imports, shared chunks or a development-server dependency.
  for (const name of ['frame-navigation', 'mobile-identity-gate', 'mobile-identity-main']) {
    await build({
      configFile: false,
      publicDir: false,
      build: {
        outDir,
        emptyOutDir: false,
        target: 'chrome145',
        sourcemap: false,
        lib: {
          entry: path(`../src/${name}.ts`),
          name: name.replaceAll('-', '_'),
          formats: ['iife'],
          fileName: () => `${name}.js`
        }
      }
    });
  }
  await build({ configFile: path('../vite.config.ts') });
  console.log('Built dist/. Reload the extension in chrome://extensions.');
}

if (!watch) {
  await compile();
} else {
  // Rebuild the whole small extension, including manifest/locales/icons. This
  // also removes obsolete hashed chunks, which separate Vite watchers would keep.
  let pending = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function rebuild() {
    if (running) return;
    running = true;
    do {
      pending = false;
      try {
        await compile();
      } catch (error) {
        console.error(error);
      }
    } while (pending);
    running = false;
  }
  const schedule = () => {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), 100);
  };
  const watchers = [
    watchFiles(path('../src'), { recursive: true }, schedule),
    watchFiles(path('../public'), { recursive: true }, schedule),
    watchFiles(path('../vite.config.ts'), schedule)
  ];
  const close = () => {
    watchers.forEach(watcher => watcher.close());
    clearTimeout(timer);
    process.exit();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  await rebuild();
  console.log('Watching src/, public/ and vite.config.ts.');
}
