import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';

const extension = JSON.parse(await readFile('public/manifest.json'));
const manifest = JSON.parse(await readFile('store/assets/manifest.json'));
assert.equal(manifest.version, extension.version, 'Recapture/render assets for this release');
assert.equal(manifest.aiSite, 'https://chatgpt.com/');
assert.equal(manifest.exports.length, 8);
assert.equal(manifest.exports.filter(item => item.width === 1280 && item.height === 800).length, 5);
for (const item of manifest.exports) {
  const bytes = await readFile(`store/assets/${item.file}`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), item.width);
  assert.equal(bytes.readUInt32BE(20), item.height);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
}
for (const locale of await readdir('public/_locales')) {
  const catalog = JSON.parse(await readFile(`public/_locales/${locale}/messages.json`));
  assert(catalog.extensionDescription.message.length <= 132, `${locale}: description limit`);
}
const extensionPath = `releases/sidebrowser-${extension.version}.zip`;
const extensionZip = await readFile(extensionPath);
const runtimeFiles = unzipSync(extensionZip);
assert(runtimeFiles['manifest.json'], 'Extension ZIP must have manifest.json at root');
assert(
  !Object.keys(runtimeFiles).some(file => /^(store|docs|scripts|tests|node_modules)\//.test(file))
);
const files = {};
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile() && !entry.name.startsWith('.')) files[path] = await readFile(path);
  }
}
await collect('store');
files['docs/privacy-policy.md'] = await readFile('docs/privacy-policy.md');
files['icons/sidebrowser.svg'] = await readFile('icons/sidebrowser.svg');
files[extensionPath] = extensionZip;
files['README.txt'] = new TextEncoder().encode(
  'SideBrowser store preparation pack\nOpen store/index.html to review images. Upload only releases/sidebrowser-' +
    extension.version +
    '.zip as the extension package. Store images are in store/assets/. Copy is in store/listing.*.md. Follow store/submission.md for privacy and permission fields. Privacy policy: https://yuzhouu.github.io/side-browser/privacy/ (confirm Pages deployment before submitting). This preparation pack itself is NOT an installable extension.\n'
);
await mkdir('releases', { recursive: true });
const target = `releases/sidebrowser-store-${extension.version}.zip`;
await writeFile(target, zipSync(files, { level: 9 }));
console.log(
  `Verified 5 screenshots, 2 promo images, icon, all locale descriptions, and extension ZIP.\n${target}`
);
