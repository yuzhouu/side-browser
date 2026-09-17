import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { zipSync, unzipSync } from 'fflate';

const extension = JSON.parse(await readFile('public/manifest.json'));
const manifest = JSON.parse(await readFile('store/manifest.json'));
assert.equal(manifest.version, extension.version, 'Recapture/render assets for this release');
assert.equal(manifest.aiSite, 'https://chatgpt.com/');
assert.deepEqual(manifest.locales, ['zh-CN', 'en']);
assert.equal(manifest.exports.length, 16);
for (const locale of manifest.locales) {
  const images = manifest.exports.filter(item => item.locale === locale);
  assert.equal(images.length, 8, `${locale}: five screenshots, two promotional images and icon`);
  assert.equal(images.filter(item => item.width === 1280 && item.height === 800).length, 5);
  assert(images.some(item => item.width === 440 && item.height === 280));
  assert(images.some(item => item.width === 1400 && item.height === 560));
  assert(images.some(item => item.width === 128 && item.height === 128));
  assert(images.every(item => item.file.startsWith(`${locale}/`)));
  const source = JSON.parse(await readFile(`store/${manifest.captures[locale]}`));
  if (locale === 'en') assert(/^en(?:-|$)/.test(source.browserLocale));
}
for (const item of manifest.exports) {
  const bytes = await readFile(`store/${item.file}`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), item.width);
  assert.equal(bytes.readUInt32BE(20), item.height);
  if (basename(item.file) !== 'store-icon-128.png')
    assert.equal(bytes[25], 2, `${item.file}: RGB without alpha`);
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
    '.zip as the extension package. Chinese materials are in store/zh-CN/; English materials are in store/en/. Both sets use localized copy and real UI captures. Each language folder contains listing.md, images and its own guide. Read store/en/README.md or store/README.md, and follow store/submission.md for privacy and permission fields. Privacy policy: https://yuzhouu.github.io/side-browser/privacy/ (confirm Pages deployment before submitting). This preparation pack itself is NOT an installable extension.\n'
);
await mkdir('releases', { recursive: true });
for (const locale of manifest.locales) {
  const localized = {};
  const images = manifest.exports.filter(item => item.locale === locale);
  for (const image of images)
    localized[basename(image.file)] = await readFile(`store/${image.file}`);
  localized['listing.md'] = await readFile(`store/${locale}/listing.md`);
  localized['privacy-policy.md'] = await readFile('docs/privacy-policy.md');
  localized['manifest.json'] = new TextEncoder().encode(
    JSON.stringify(
      {
        version: extension.version,
        locale,
        exports: images.map(item => ({ ...item, file: basename(item.file) }))
      },
      null,
      2
    ) + '\n'
  );
  localized['README.txt'] = new TextEncoder().encode(
    locale === 'en'
      ? 'SideBrowser — English store assets\nUse listing.md for English listing fields and description. Upload 01–05 as screenshots, promo-small as the small promotional image, and optionally promo-marquee as the wide promotional image. Use store-icon-128.png as the shared store icon. Images use real English UI screenshots. Upload the separate sidebrowser-' +
          extension.version +
          '.zip as the extension itself; this assets ZIP is not installable.\n'
      : '侧窗 · SideBrowser — 简体中文商店资料\n从 listing.md 复制中文名称、简短介绍和详细介绍。01–05 为说明截图，promo-small 为小宣传图，promo-marquee 为可选横幅，store-icon-128.png 为共用商店图标。图片采用真实中文界面截图。扩展本体请单独上传 sidebrowser-' +
          extension.version +
          '.zip；此资料 ZIP 不可安装。\n'
  );
  const localizedPath = `releases/sidebrowser-store-${locale}-${extension.version}.zip`;
  await writeFile(localizedPath, zipSync(localized, { level: 9 }));
  const packed = unzipSync(await readFile(localizedPath));
  assert.equal(Object.keys(packed).filter(name => name.endsWith('.png')).length, 8);
  for (const image of images)
    assert.equal(
      createHash('sha256').update(packed[basename(image.file)]).digest('hex'),
      image.sha256
    );
  console.log(localizedPath);
}
const target = `releases/sidebrowser-store-${extension.version}.zip`;
await writeFile(target, zipSync(files, { level: 9 }));
console.log(
  `Verified both locales: 10 screenshots, 4 promo images, shared icon, descriptions, localized ZIPs and extension ZIP.\n${target}`
);
