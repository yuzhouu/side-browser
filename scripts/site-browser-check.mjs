import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { content } from '../website/content.mjs';
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
  for (const locale of ['en', 'zh', 'ja']) {
    const prefix = `${locale}/`;
    await page.goto(base + prefix);
    assert.equal(await page.title(), content[locale].pageTitle);
    assert.equal(page.url(), base + prefix);
    assert.equal(await page.locator('html').getAttribute('lang'), content[locale].lang);
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
        const header = await page.evaluate(() => {
          const brand = document.querySelector('.header .brand').getBoundingClientRect();
          const controls = document.querySelector('.controls').getBoundingClientRect();
          return { brandRight: brand.right, controlsLeft: controls.left };
        });
        assert(header.controlsLeft - header.brandRight >= 6, `Header overlap: ${locale}/${width}`);
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
    await page.screenshot({
      path: `${output}/home-${locale}-dark.png`,
      fullPage: true,
      animations: 'disabled'
    });
    await page.locator('[data-theme-toggle]').click();
    await page.screenshot({
      path: `${output}/home-${locale}-light.png`,
      fullPage: true,
      animations: 'disabled'
    });
    await page.screenshot({ path: `${output}/home-${locale}-desktop.png`, animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.locator('.language').click();
    for (const link of await page.locator('[data-locale]').all()) {
      assert(await link.isVisible(), 'Language choices visible at 320px');
      const box = await link.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= 320, 'Language menu fits narrow viewport');
    }
    await page.screenshot({ path: `${output}/home-${locale}-320.png` });
    await page.keyboard.press('Escape');
    assert(!(await page.locator('.language-menu').evaluate(element => element.open)));
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto(base + 'en/');
  await page.locator('.language').click();
  await page.locator('[data-locale="ja"]').click();
  assert.equal(page.url(), base + 'ja/');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.locator('.nav a').last().click();
  assert.equal(page.url(), base + 'ja/privacy/');
  await page.locator('.language').click();
  await page.locator('[data-locale="zh"]').click();
  assert.equal(page.url(), base + 'zh/privacy/');
  await page.locator('.header .brand').click();
  assert.equal(page.url(), base + 'zh/');
  await page.goto(base);
  await page.waitForURL(base + 'zh/');
  assert.equal(await page.evaluate(() => localStorage.getItem('sidebrowser-site-language')), 'zh');
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
  const scenarios = [
    { languages: ['ja-JP', 'en-US'], expected: 'ja' },
    { languages: ['zh-CN', 'en'], expected: 'zh' },
    { languages: ['zh-TW'], expected: 'zh' },
    { languages: ['en-GB', 'ja'], expected: 'en' },
    { languages: ['fr-FR', 'ja-JP', 'en'], expected: 'ja' },
    { languages: ['de-DE', 'fr-FR'], expected: 'en' },
    { languages: [], language: 'ja-JP', expected: 'ja' },
    { languages: [], language: '', expected: 'en' },
    { languages: ['ja-JP'], saved: 'en', expected: 'en' },
    { languages: ['en-US'], saved: 'ja', expected: 'ja' },
    { languages: ['ja-JP'], saved: 'invalid', expected: 'ja' },
    { languages: ['ja-JP'], blockedStorage: true, expected: 'ja' }
  ];
  for (const scenario of scenarios) {
    const languageContext = await browser.newContext({ locale: scenario.languages[0] || 'en-US' });
    await languageContext.addInitScript(config => {
      Object.defineProperty(navigator, 'languages', { get: () => config.languages });
      Object.defineProperty(navigator, 'language', {
        get: () => config.language ?? config.languages[0]
      });
      if (config.blockedStorage) {
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new DOMException('Storage blocked', 'SecurityError');
          }
        });
      } else if (config.saved) {
        localStorage.setItem('sidebrowser-site-language', config.saved);
      }
    }, scenario);
    const languagePage = await languageContext.newPage();
    languagePage.on('pageerror', error => errors.push(error.message));
    for (const route of ['', 'privacy/']) {
      const suffix = route ? '?source=qa#policy-1' : '?source=qa#features';
      const prefix = scenario.expected === 'en' ? '' : `${scenario.expected}/`;
      await languagePage.goto(base + route + suffix);
      await languagePage.waitForURL(base + prefix + route + suffix);
      assert.equal(
        await languagePage.locator('html').getAttribute('lang'),
        content[scenario.expected].lang
      );
      assert.equal(await languagePage.locator('h1').count(), 1);
    }
    // Explicit links override both browser settings and a saved preference.
    for (const locale of ['en', 'zh', 'ja']) {
      await languagePage.goto(base + locale + '/');
      assert.equal(languagePage.url(), base + locale + '/');
      assert.equal(await languagePage.locator('html').getAttribute('lang'), content[locale].lang);
    }
    await languageContext.close();
  }
  // A manual choice survives reloads and new pages, without redirect loops.
  await page.goto(base + 'ja/privacy/?source=qa#policy-2');
  await page.locator('.language').click();
  await page.locator('[data-locale="en"]').click();
  assert.equal(page.url(), base + 'en/privacy/?source=qa#policy-2');
  await page.reload();
  assert.equal(page.url(), base + 'en/privacy/?source=qa#policy-2');
  await page.goto(base + 'privacy/');
  assert.equal(page.url(), base + 'privacy/');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.goto(base + 'en/');
  await page.locator('.nav a').first().click();
  await page.locator('.language').click();
  await page.locator('[data-locale="ja"]').click();
  assert.equal(page.url(), base + 'ja/#features', 'Preserve an anchor selected after loading');
  const noScriptContext = await browser.newContext({ javaScriptEnabled: false, locale: 'ja-JP' });
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(base);
  assert.equal(await noScriptPage.locator('html').getAttribute('lang'), 'en');
  await noScriptPage.locator('.language').click();
  await noScriptPage.locator('[data-locale="ja"]').click();
  assert.equal(noScriptPage.url(), base + 'ja/');
  assert.equal(await noScriptPage.locator('h1').count(), 1);
  await noScriptPage.goto(base + 'ja/privacy/');
  assert(await noScriptPage.locator('.policy-body').innerText());
  await noScriptContext.close();
  assert.deepEqual(errors, []);
  console.log(
    `Verified three languages in both themes, automatic detection and fallback, saved language, explicit routes, no-JS/storage-blocked access, extension ZIP download, scene/language navigation and 6 pages at 1440/768/390/320px. No console errors or warnings. Screenshots: ${output}`
  );
} finally {
  await browser.close();
}
