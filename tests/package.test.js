import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { packageExtension } from '../scripts/package.ts';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sidebrowser-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist/assets'), { recursive: true });
  await mkdir(join(root, 'releases/archive'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ version: '1.0.0' }));
  await writeFile(join(root, 'dist/assets/page.js'), 'current runtime');
  await writeFile(join(root, 'releases/sidebrowser-1.6.5.zip'), 'old package');
  await writeFile(join(root, 'releases/archive/old.zip'), 'older archive');
  await writeFile(join(root, 'keep.txt'), 'outside releases');
  return root;
}

test('packaging clears old releases and leaves only the current runtime ZIP', async t => {
  const root = await fixture(t);
  const destination = await packageExtension(root);
  assert.deepEqual(await readdir(join(root, 'releases')), ['sidebrowser-1.0.0.zip']);
  const packed = unzipSync(await readFile(destination));
  assert.deepEqual(Object.keys(packed).sort(), ['assets/page.js', 'manifest.json']);
  assert.equal(new TextDecoder().decode(packed['assets/page.js']), 'current runtime');
  assert.equal(JSON.parse(new TextDecoder().decode(packed['manifest.json'])).version, '1.0.0');
  assert.equal(await readFile(join(root, 'keep.txt'), 'utf8'), 'outside releases');

  // A second build at the same version must replace its previous contents.
  await writeFile(join(root, 'dist/assets/page.js'), 'updated runtime');
  await packageExtension(root);
  const updated = unzipSync(await readFile(destination));
  assert.equal(new TextDecoder().decode(updated['assets/page.js']), 'updated runtime');
  assert.deepEqual(await readdir(join(root, 'releases')), ['sidebrowser-1.0.0.zip']);
});

test('unreadable or mismatched build metadata preserves the previous packages', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ version: '2.0.0' }));
  await assert.rejects(packageExtension(root), /same valid version/);
  await rm(join(root, 'dist/manifest.json'));
  await assert.rejects(packageExtension(root), { code: 'ENOENT' });
  assert.equal(await readFile(join(root, 'releases/sidebrowser-1.6.5.zip'), 'utf8'), 'old package');
  assert.equal(await readFile(join(root, 'releases/archive/old.zip'), 'utf8'), 'older archive');
});
