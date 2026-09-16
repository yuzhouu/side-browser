import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.SITE_URL || 'http://127.0.0.1:4179/side-browser/';
const output = process.env.SITE_QA_DIR || '/tmp/sidebrowser-website-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: 'light',
  acceptDownloads: true
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
try {
  const captures = [];
  for (const locale of ['zh', 'en']) {
    const prefix = locale === 'en' ? 'en/' : '';
    await page.goto(base + prefix + 'media/');
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('[data-theme-toggle]').click();
      for (const [index, scene] of ['ai-chatgpt', 'wiki', 'search'].entries()) {
        await page.locator('#scene-select').selectOption(String(index));
        await page.waitForFunction(() => !document.querySelector('#export-image').disabled);
        const downloaded = page.waitForEvent('download');
        await page.locator('#export-image').click();
        const file = await downloaded;
        assert.equal(
          file.suggestedFilename(),
          `sidebrowser-${scene}-${locale}-${theme}-1280x800.png`
        );
        const path = `${output}/${file.suggestedFilename()}`;
        await file.saveAs(path);
        const bytes = await readFile(path);
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(bytes.readUInt32BE(16), 1280);
        assert.equal(bytes.readUInt32BE(20), 800);
        assert.equal(bytes[25], 2, 'Store-compatible RGB PNG without alpha');
        assert(bytes.length > 25000, 'Image should contain screenshot pixels');
        captures.push(file.suggestedFilename());
      }
    }
    for (const route of ['', 'media/', 'privacy/']) {
      await page.goto(base + prefix + route);
      assert.equal(
        await page.locator('html').getAttribute('data-theme'),
        'dark',
        'Appearance survives navigation'
      );
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const geometry = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth
        }));
        assert(
          geometry.scroll <= geometry.width,
          `Horizontal overflow: ${prefix + route} at ${width}`
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + prefix);
    for (const index of [1, 2, 0]) {
      await page.locator(`[data-scene="${index}"]`).click();
      await page.waitForFunction(() =>
        ['hero-main-screenshot', 'hero-screenshot'].every(id => {
          const image = document.getElementById(id);
          return image.complete && image.naturalWidth > 0;
        })
      );
      const layout = await page.evaluate(() => {
        const main = document.querySelector('.main-page').getBoundingClientRect();
        const sidebar = document.querySelector('#hero-screenshot').getBoundingClientRect();
        return {
          mainWidth: main.width,
          sideWidth: sidebar.width,
          mainRight: main.right,
          sideLeft: sidebar.left
        };
      });
      assert(
        layout.mainWidth > layout.sideWidth * 2 && layout.sideLeft >= layout.mainRight,
        'Main page remains visible beside sidebar'
      );
    }
    await page.screenshot({ path: `${output}/home-${locale}-dark.png`, fullPage: true });
    await page.locator('[data-theme-toggle]').click();
    await page.screenshot({ path: `${output}/home-${locale}-light.png`, fullPage: true });
  }
  await page.goto(base + 'en/media/');
  const zipPromise = page.waitForEvent('download');
  await page.locator('a[download][href$="sidebrowser-media.zip"]').click();
  const zip = await zipPromise;
  await zip.saveAs(`${output}/${zip.suggestedFilename()}`);
  const buffer = await readFile(`${output}/${zip.suggestedFilename()}`);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  assert.deepEqual(errors, []);
  console.log(
    `Verified ${captures.length} real PNG downloads (3 scenes × 2 languages × 2 themes), media ZIP, persisted theme and 6 pages at 1440/768/390/320px. No console errors. Screenshots: ${output}`
  );
} finally {
  await browser.close();
}
