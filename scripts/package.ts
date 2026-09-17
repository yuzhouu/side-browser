import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

export async function packageExtension(project = fileURLToPath(new URL('../', import.meta.url))) {
  const dist = join(project, 'dist');
  const releases = join(project, 'releases');
  const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8')) as {
    version: string;
  };
  const pkg = JSON.parse(await readFile(join(project, 'package.json'), 'utf8')) as {
    version: string;
  };
  if (!/^\d+(?:\.\d+){1,3}$/.test(manifest.version) || manifest.version !== pkg.version)
    throw new Error('package.json and dist/manifest.json must have the same valid version');

  const files: Record<string, Uint8Array> = {};
  async function collect(directory = '') {
    for (const entry of await readdir(join(dist, directory), { withFileTypes: true })) {
      const relative = `${directory}${entry.name}`;
      if (entry.isDirectory()) await collect(`${relative}/`);
      else if (entry.isFile()) files[relative] = await readFile(join(dist, relative));
    }
  }
  await collect();
  const archive = zipSync(files, { level: 9 });
  const filename = `sidebrowser-${manifest.version}.zip`;
  const destination = join(releases, filename);
  // Only clean generated packages after the build has been read and compressed.
  await rm(releases, { recursive: true, force: true });
  await mkdir(releases, { recursive: true });
  await writeFile(destination, archive);
  console.log(`Current local package: ${destination} (${archive.length} bytes)`);
  console.log('releases/ now contains only the new ZIP, with manifest.json at its root.');
  return destination;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await packageExtension();
