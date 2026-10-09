import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import { content } from '../website/content.mjs';

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
assert.equal(pages.length, 9, 'Six localized pages, two automatic entries and 404');
for (const locale of ['zh', 'ja']) {
  assert.deepEqual(Object.keys(content[locale]).sort(), Object.keys(content.en).sort());
}
let links = 0;
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  assert(html.includes('data-theme-toggle'), file);
  for (const lang of ['zh-CN', 'en', 'ja', 'x-default']) {
    assert(html.includes(`hreflang="${lang}"`), `${file}: missing ${lang} alternate`);
  }
  for (const locale of ['en', 'zh', 'ja']) {
    assert(html.includes(`data-locale="${locale}"`), `${file}: missing language option`);
  }
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
assert.deepEqual(await readdir(join(root, 'assets/downloads')), [`sidebrowser-${pkg.version}.zip`]);
for (const prefix of ['', 'en/', 'zh/', 'ja/']) {
  assert(!(await readdir(join(root, prefix))).includes('media'), 'Media routes are removed');
}
const zh = await readFile(join(root, 'zh/privacy/index.html'), 'utf8');
const en = await readFile(join(root, 'en/privacy/index.html'), 'utf8');
const ja = await readFile(join(root, 'ja/privacy/index.html'), 'utf8');
assert(
  [zh, en, ja].every(html => html.includes('GitHub Pages')),
  'Hosting disclosure included'
);
assert(
  zh.includes('最近主动打开的最多 10') && en.includes('Up to 10') && ja.includes('直近 10 件'),
  'Extension disclosure included'
);
for (const route of ['', 'privacy/']) {
  const entry = await readFile(join(root, route, 'index.html'), 'utf8');
  assert(entry.includes('<html lang="en">'), 'Default content is English without JavaScript');
  assert(entry.includes('data-auto-language="true"'), 'Default entry detects language');
  for (const locale of ['en', 'zh', 'ja']) {
    const localized = await readFile(join(root, locale, route, 'index.html'), 'utf8');
    assert(localized.includes(`lang="${content[locale].lang}"`));
    assert(localized.includes('data-auto-language="false"'), 'Explicit language stays stable');
    assert(!localized.includes('undefined'), 'No missing translations');
  }
}
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
for (const locale of ['en', 'zh', 'ja']) {
  assert(sitemap.includes(`${base}${locale}/</loc>`));
  assert(sitemap.includes(`${base}${locale}/privacy/</loc>`));
}
console.log(
  `Checked ${pages.length} pages, ${links} local links/anchors/assets, three privacy policies, locale metadata and the extension ZIP.`
);
