import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { unzipSync } from 'fflate';

const root = resolve('site-dist');
const base = process.env.SITE_BASE_PATH || '/side-browser/';
const pages = [];
async function collect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.name.endsWith('.html')) pages.push(file);
  }
}
await collect(root);
assert.equal(pages.length, 7, 'Six localized pages plus 404');
let links = 0;
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  assert(html.includes('data-theme-toggle'), file);
  assert(html.includes('hreflang="zh-CN"') && html.includes('hreflang="en"'), file);
  for (const [, value] of html.matchAll(/(?:href|src)="([^"\s]+)"/g)) {
    if (/^(?:https?:|data:|mailto:)/.test(value)) continue;
    const [path, anchor] = value.split('#');
    let target = path.startsWith(base)
      ? resolve(root, path.slice(base.length))
      : path
        ? resolve(dirname(file), path)
        : file;
    assert(target === root || target.startsWith(root + '/'), `Link escapes site: ${value}`);
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
    assert((await stat(target)).isFile(), `Missing: ${value}`);
    if (anchor)
      assert(
        (await readFile(target, 'utf8')).includes(`id="${anchor}"`),
        `Missing anchor ${value}`
      );
    links++;
  }
  assert(!/https?:\/\/localhost|TODO|PLACEHOLDER/.test(html), file);
}
const pkg = JSON.parse(await readFile('public/manifest.json'));
const zip = unzipSync(
  await readFile(join(root, 'assets/downloads', `sidebrowser-${pkg.version}.zip`))
);
assert.equal(JSON.parse(new TextDecoder().decode(zip['manifest.json'])).version, pkg.version);
assert(!Object.keys(zip).some(path => /^(website|store|site-dist|node_modules)\//.test(path)));
const media = unzipSync(await readFile(join(root, 'assets/downloads/sidebrowser-media.zip')));
assert(media['zh-CN/description.txt'] && media['en/description.txt'] && media['sidebrowser.svg']);
assert.equal(Object.keys(media).filter(name => name.endsWith('.png')).length, 16);
assert.equal(
  Object.keys(media).filter(name => name.startsWith('en/') && name.endsWith('.png')).length,
  8
);
for (const name of Object.keys(media).filter(name => name.endsWith('.png'))) {
  assert.equal(Buffer.from(media[name]).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.deepEqual(Buffer.from(media[name]), await readFile(join(root, 'assets', name)), name);
}
for (const prefix of ['', 'en/']) {
  const assetPrefix = prefix || 'zh-CN/';
  const gallery = await readFile(join(root, prefix, 'media/index.html'), 'utf8');
  const images = [...gallery.matchAll(/class="asset-image" href="([^"]+)"/g)].map(
    match => match[1]
  );
  assert.equal(images.length, 7);
  assert(images.every(path => path.startsWith(`${base}assets/${assetPrefix}`)));
  assert(gallery.includes(`${base}assets/${assetPrefix}store-icon-128.png`));
  const home = await readFile(join(root, prefix, 'index.html'), 'utf8');
  assert(home.includes(`${base}assets/${assetPrefix}01-ai-beside-you.png`));
  assert(home.includes(`${base}assets/${assetPrefix}promo-marquee-1400x560.png`));
}
const zh = await readFile(join(root, 'privacy/index.html'), 'utf8');
const en = await readFile(join(root, 'en/privacy/index.html'), 'utf8');
assert(zh.includes('GitHub Pages') && en.includes('GitHub Pages'), 'Hosting disclosure included');
assert(
  zh.includes('最近主动打开的最多 10') && en.includes('Up to 10'),
  'Extension disclosure included'
);
console.log(
  `Checked ${pages.length} pages, ${links} local links/anchors/assets, both privacy policies and both download ZIPs.`
);
