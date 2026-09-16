import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')) as {
  version: string;
};
const files: Record<string, Uint8Array> = {};
async function collect(directory: string) {
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    const relative = `${directory}${entry.name}`;
    if (entry.isDirectory()) await collect(`${relative}/`);
    else if (entry.isFile()) files[relative] = await readFile(new URL(relative, root));
  }
}
await collect('');
const destination = new URL(`../releases/sidebrowser-${manifest.version}.zip`, import.meta.url);
await mkdir(new URL('../releases/', import.meta.url), { recursive: true });
const archive = zipSync(files, { level: 9 });
await writeFile(destination, archive);
console.log(`${fileURLToPath(destination)} (${archive.length} bytes; manifest.json at ZIP root)`);
