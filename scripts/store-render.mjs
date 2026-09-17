import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('store/assets');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const exports = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });
  await page.goto(pathToFileURL(resolve('store/design.html')).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  for (const board of await page.locator('[data-export]').all()) {
    const name = await board.getAttribute('data-export');
    const box = await board.boundingBox();
    const path = resolve(output, `${name}.png`);
    if (name === 'store-icon-128')
      await page.evaluate(() => {
        document.body.style.background = 'transparent';
      });
    await board.screenshot({
      path,
      omitBackground: name === 'store-icon-128',
      animations: 'disabled'
    });
    const bytes = await readFile(path);
    if (bytes.readUInt32BE(16) !== box.width || bytes.readUInt32BE(20) !== box.height)
      throw new Error(`Invalid dimensions: ${name}`);
    if (name !== 'store-icon-128' && bytes[25] !== 2)
      throw new Error(`Expected RGB PNG without alpha: ${name}`);
    const item = {
      file: `${name}.png`,
      width: box.width,
      height: box.height,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    };
    exports.push(item);
    console.log(`${item.file}: ${item.width} × ${item.height}, ${bytes.length} bytes`);
  }
  const source = JSON.parse(await readFile(resolve(output, 'source/capture.json')));
  const manifest = JSON.parse(await readFile('public/manifest.json'));
  await writeFile(
    resolve(output, 'manifest.json'),
    JSON.stringify(
      {
        version: manifest.version,
        renderedAt: new Date().toISOString(),
        locale: 'zh-CN',
        design: '../design.html',
        capture: 'source/capture.json',
        screenshotMethod:
          'Unmodified screenshots from native Chrome side panel. Exact HTML/CSS text, framing and crops added outside the product UI. AI overview, research page and marquee combine screenshots of the main tab and sidebar. Detail pages intentionally focus on specific sidebar controls.',
        aiSite: 'https://chatgpt.com/',
        sourceBrowser: source.browser,
        exports
      },
      null,
      2
    ) + '\n'
  );
  await writeFile(
    resolve('store/index.html'),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>侧窗 · 商店资料</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f5f0;color:#18354d;font:16px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1320px;padding:48px 28px;margin:auto}header{margin-bottom:36px}h1{font-size:36px;margin:0 0 12px}p{margin:10px 0}a{color:#176cae}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}figure{margin:0;min-width:0}img{display:block;max-width:100%;height:auto;border:1px solid #d9e1e6}figcaption{padding:12px 0;color:#5c7182}.small img{width:auto}.manifest{padding:20px 0} @media(max-width:760px){.grid{grid-template-columns:1fr}main{padding:25px 16px}h1{font-size:28px}}</style><main><header><h1>侧窗 · SideBrowser</h1><p>效率工具 · 商店资料 · ${manifest.version}</p><p>输入任意网址，打开自己常用的网站。ChatGPT、维基百科与 Google 搜索仅为使用示例；真实截图附功能说明，可点击查看或下载原尺寸。</p><p><a href="listing.zh-CN.md">中文介绍</a> · <a href="listing.en.md">English listing</a> · <a href="../docs/privacy-policy.md">隐私政策</a> · <a href="submission.md">提交填写说明</a> · <a href="../releases/sidebrowser-${manifest.version}.zip">扩展安装 ZIP</a></p></header><div class="grid">${exports.map(item => `<figure class="${item.width < 1000 ? 'small' : ''}"><a href="assets/${item.file}"><img src="assets/${item.file}" alt="${item.file}" width="${item.width}" height="${item.height}"></a><figcaption><a download href="assets/${item.file}">${item.file}</a> · ${item.width} × ${item.height}</figcaption></figure>`).join('')}</div><p class="manifest"><a href="assets/manifest.json">尺寸与 SHA-256 清单</a> · <a href="assets/source/capture.json">实拍来源</a></p><p>资料已准备；尚未提交商店。官网与公开隐私政策由 GitHub Pages 发布，开发者账号信息在商店后台完成。</p></main></html>`
  );
} finally {
  await browser.close();
}
