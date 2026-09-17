import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('store');
const locales = ['zh-CN', 'en'];
for (const locale of locales) await mkdir(resolve(output, locale), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const exports = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const locale of locales) {
    const url = pathToFileURL(resolve('store/design.html'));
    url.searchParams.set('lang', locale);
    await page.goto(url.href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    if (errors.length) throw new Error(errors.join('\n'));
    if (locale === 'en' && /\p{Script=Han}/u.test(await page.locator('body').innerText()))
      throw new Error('Untranslated Chinese artwork text in English export');
    for (const board of await page.locator('[data-export]').all()) {
      const name = await board.getAttribute('data-export');
      const shared = name === 'store-icon-128';
      const box = await board.boundingBox();
      const file = `${locale}/${name}.png`;
      const path = resolve(output, file);
      if (shared)
        await page.evaluate(() => {
          document.body.style.background = 'transparent';
        });
      await board.screenshot({ path, omitBackground: shared, animations: 'disabled' });
      const bytes = await readFile(path);
      if (bytes.readUInt32BE(16) !== box.width || bytes.readUInt32BE(20) !== box.height)
        throw new Error(`Invalid dimensions: ${file}`);
      if (!shared && bytes[25] !== 2) throw new Error(`Expected RGB PNG without alpha: ${file}`);
      const item = {
        file,
        locale,
        width: box.width,
        height: box.height,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex')
      };
      exports.push(item);
      console.log(`${item.file}: ${item.width} × ${item.height}, ${bytes.length} bytes`);
    }
  }
  const source = JSON.parse(await readFile(resolve(output, 'assets/source/capture.json')));
  const englishSource = JSON.parse(
    await readFile(resolve(output, 'assets/source/en/capture.json'))
  );
  const manifest = JSON.parse(await readFile('public/manifest.json'));
  await writeFile(
    resolve(output, 'manifest.json'),
    JSON.stringify(
      {
        version: manifest.version,
        renderedAt: new Date().toISOString(),
        defaultLocale: 'zh-CN',
        locales,
        design: 'design.html',
        captures: { 'zh-CN': 'assets/source/capture.json', en: 'assets/source/en/capture.json' },
        screenshotMethod:
          'Unmodified screenshots from native Chrome side panel in each locale. Exact HTML/CSS text, framing and crops added outside the product UI. AI overview, research page and marquee combine screenshots of the main tab and sidebar. Detail pages intentionally focus on specific sidebar controls.',
        aiSite: 'https://chatgpt.com/',
        sourceBrowsers: { 'zh-CN': source.browser, en: englishSource.browser },
        exports
      },
      null,
      2
    ) + '\n'
  );
  const gallery = items =>
    items
      .map(
        item =>
          `<figure class="${item.width < 1000 ? 'small' : ''}"><a href="${item.file}"><img src="${item.file}" alt="${item.file}" width="${item.width}" height="${item.height}" loading="lazy"></a><figcaption><a download href="${item.file}">${item.file}</a> · ${item.width} × ${item.height}</figcaption></figure>`
      )
      .join('');
  const sections = locales
    .map(
      locale =>
        `<section id="${locale}" lang="${locale}"><h2>${locale === 'en' ? 'English' : '简体中文'}</h2><p>${locale === 'en' ? 'English copy and real English UI screenshots. Five screenshots, two promotional images and the store icon.' : '中文文案与真实中文界面截图。5 张说明图、2 张宣传图和商店图标。'} <a href="${locale}/listing.md">${locale === 'en' ? 'Store listing copy' : '商店介绍文案'}</a> · <a href="design.html?lang=${locale}">${locale === 'en' ? 'Editable layout' : '排版源稿'}</a></p><div class="grid">${gallery(exports.filter(item => item.locale === locale))}</div></section>`
    )
    .join('');
  await writeFile(
    resolve('store/index.html'),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SideBrowser · 中英文商店资料 / Store assets</title><style>*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f5f0;color:#18354d;font:16px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1320px;padding:48px 28px;margin:auto}header{margin-bottom:36px}h1{font-size:36px;margin:0 0 12px}h2{font-size:28px;margin:0 0 10px}p{margin:10px 0}a{color:#176cae}nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:24px}nav a{padding:8px 18px;border:1px solid #bed0dd;border-radius:8px;text-decoration:none;background:white}section{margin:48px 0;scroll-margin-top:24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px;margin-top:24px}figure{margin:0;min-width:0}img{display:block;max-width:100%;height:auto;border:1px solid #d9e1e6}figcaption{padding:12px 0;color:#5c7182;overflow-wrap:anywhere}.small img{width:auto}.manifest{padding:20px 0}@media(max-width:760px){.grid{grid-template-columns:1fr}main{padding:25px 16px}h1{font-size:28px}}</style><main><header><h1>侧窗 · SideBrowser</h1><p>中英文商店资料 / Bilingual store assets · ${manifest.version}</p><p>两套本地化文案、截图与宣传图。网站仅为使用示例，可换成你常用的网站。<br>Localized copy, screenshots and promotional images. The websites shown are examples; choose your own.</p><p><a href="../docs/privacy-policy.md">隐私政策 / Privacy</a> · <a href="submission.md">提交说明</a> · <a href="en/README.md">English guide</a> · <a href="../releases/sidebrowser-${manifest.version}.zip">扩展安装 ZIP / Extension ZIP</a></p><nav aria-label="选择资料语言 / Choose a language"><a href="#zh-CN">简体中文</a><a href="#en">English</a></nav></header>${sections}<p class="manifest"><a href="manifest.json">尺寸与 SHA-256 / Dimensions and checksums</a> · <a href="assets/source/capture.json">中文实拍来源</a> · <a href="assets/source/en/capture.json">English screenshot sources</a></p><p>本地资料准备完成；尚未提交商店。 / Prepared locally; not submitted to the store.</p></main></html>`
  );
} finally {
  await browser.close();
}
