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
  if (['error', 'warning'].includes(message.type())) errors.push(message.text());
});
try {
  for (const locale of ['zh', 'en']) {
    const prefix = locale === 'en' ? 'en/' : '';
    await page.goto(base + prefix);
    assert.equal(
      await page.title(),
      locale === 'zh'
        ? '侧窗 · SideBrowser — 常用的网站，就在你手边'
        : 'SideBrowser — Your websites, right beside you'
    );
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('a[href*="/media/"]').count(), 0);
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('[data-theme-toggle]').click();
      await page.locator('.binding-faq summary').click();
      assert(await page.locator('.binding-faq').evaluate(element => element.open));
      assert(await page.locator('.binding-faq p').first().isVisible());
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const geometry = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth
        }));
        assert(geometry.scroll <= geometry.width, `Binding overflow: ${locale}/${theme}/${width}`);
      }
      await page
        .locator('.binding')
        .screenshot({ path: `${output}/binding-${locale}-${theme}-320.png` });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .locator('.binding')
        .screenshot({ path: `${output}/binding-${locale}-${theme}.png` });
      await page.locator('.binding-faq summary').click();
      assert(!(await page.locator('.binding-faq').evaluate(element => element.open)));
    }
    for (const route of ['', 'privacy/']) {
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
  await page.goto(base);
  await page.locator('.language').click();
  assert.equal(page.url(), base + 'en/');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.locator('.nav a').last().click();
  assert.equal(page.url(), base + 'en/privacy/');
  await page.locator('.language').click();
  assert.equal(page.url(), base + 'privacy/');
  await page.locator('.header .brand').click();
  assert.equal(page.url(), base);
  const zipPromise = page.waitForEvent('download');
  await page.locator('a[download][href$=".zip"]').click();
  const zip = await zipPromise;
  await zip.saveAs(`${output}/${zip.suggestedFilename()}`);
  const buffer = await readFile(`${output}/${zip.suggestedFilename()}`);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  for (const path of ['media/', 'en/media/', 'assets/downloads/sidebrowser-media.zip']) {
    const response = await context.request.get(base + path);
    assert.equal(response.status(), 404, `Removed public asset: ${path}`);
  }
  assert.deepEqual(errors, []);
  console.log(
    `Verified bilingual binding details in both themes, removed media routes, extension ZIP download, scene/language navigation, persisted theme and 4 pages at 1440/768/390/320px. No console errors or warnings. Screenshots: ${output}`
  );
} finally {
  await browser.close();
}
