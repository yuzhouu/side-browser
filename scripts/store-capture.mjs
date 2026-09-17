import { chromium } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { attachTarget, poll } from './browser/cdp.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const locale = process.env.STORE_LOCALE || 'zh-CN';
assert(['zh-CN', 'en'].includes(locale), 'STORE_LOCALE must be zh-CN or en');
const english = locale === 'en';
const featuresOnly = process.env.STORE_CAPTURE_SCOPE === 'features';
const articleUrl = english
  ? 'https://en.wikipedia.org/wiki/Pomodoro_Technique'
  : 'https://zh.wikipedia.org/wiki/%E7%95%AA%E8%8C%84%E5%B7%A5%E4%BD%9C%E6%B3%95';
const output = resolve('store/assets/source', english ? 'en' : '');
const profile = await mkdtemp(join(tmpdir(), 'sidebrowser-store-'));
await mkdir(output, { recursive: true });
let executablePath = process.env.CHROME_PATH || chromium.executablePath();
if (process.platform === 'darwin') {
  const original = executablePath;
  executablePath = join(profile, 'chrome.sh');
  await writeFile(
    executablePath,
    `#!/bin/sh\nexec '${original.replaceAll("'", "'\\''")}' -AppleLanguages '(${locale})' "$@"\n`,
    { mode: 0o700 }
  );
}
let context;
const diagnostics = { errors: [], warnings: [] };
let previous = {};
try {
  previous = JSON.parse(await readFile(join(output, 'capture.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const evidence = {
  ...previous,
  locale,
  ...(english
    ? {
        researchScene:
          'Two English Wikipedia pages; English research artwork uses main-research.png and wiki.png.'
      }
    : {}),
  capturedAt: new Date().toISOString(),
  captures: (previous.captures || []).filter(item => !english || item.name !== 'search'),
  diagnostics
};
const saveEvidence = () =>
  writeFile(join(output, 'capture.json'), JSON.stringify(evidence, null, 2) + '\n');
const attached = [];
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    viewport: null,
    args: [
      `--load-extension=${resolve('dist')}`,
      `--disable-extensions-except=${resolve('dist')}`,
      `--lang=${locale}`,
      '--window-size=1440,1000'
    ],
    ignoreDefaultArgs: ['--disable-extensions']
  });
  evidence.browser = context.browser().version();
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extension = worker.url().slice(0, worker.url().lastIndexOf('/'));
  const root = await context.browser().newBrowserCDPSession();
  const control = await context.newPage();
  await control.goto(`${extension}/help.html`);
  await control.evaluate(() => {
    const button = document.createElement('button');
    button.id = 'capture-open';
    button.textContent = 'Open sidebar';
    button.onclick = () =>
      chrome.windows.getCurrent().then(w => chrome.sidePanel.open({ windowId: w.id }));
    document.body.prepend(button);
  });
  await control.locator('#capture-open').click();
  const targets = async () => (await root.send('Target.getTargets')).targetInfos;
  const target = await poll(
    async () => (await targets()).find(t => t.url === `${extension}/sidepanel.html`),
    'native panel'
  );
  const panel = await attachTarget(root, target.targetId, diagnostics);
  attached.push(panel);
  await poll(
    () => panel.evaluate("Boolean(document.querySelector('#mode-label')?.textContent)"),
    'initialized'
  );
  const browserLocale = await worker.evaluate(() => chrome.i18n.getUILanguage());
  assert(english ? /^en(?:-|$)/.test(browserLocale) : browserLocale === locale);
  evidence.browserLocale = browserLocale;
  const capture = async (name, details = {}) => {
    const geometry = await panel.evaluate(
      '({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})'
    );
    const data = await panel.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `${name}.png`), Buffer.from(data.data, 'base64'));
    const receipt = {
      name,
      capturedAt: new Date().toISOString(),
      sha256: createHash('sha256').update(Buffer.from(data.data, 'base64')).digest('hex'),
      ...geometry,
      viewport: 'native Chrome side panel; no viewport emulation',
      url: await panel.evaluate("document.querySelector('#web')?.src"),
      ...details
    };
    const index = evidence.captures.findIndex(item => item.name === name);
    if (index < 0) evidence.captures.push(receipt);
    else evidence.captures[index] = receipt;
    await saveEvidence();
    console.log(`Captured ${name} ${JSON.stringify(geometry)}`);
  };
  if (!featuresOnly) {
    await control.goto(articleUrl, { waitUntil: 'load', timeout: 45000 });
    await control.locator('h1').waitFor();
    await control.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 4000));
    await control.screenshot({ path: join(output, 'main-reference.png') });
    evidence.mainPage = {
      capturedAt: new Date().toISOString(),
      sha256: createHash('sha256')
        .update(await readFile(join(output, 'main-reference.png')))
        .digest('hex'),
      url: control.url(),
      title: await control.title(),
      viewport: await control.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    };
    // A second real main page gives the encyclopedia scene a distinct reading context.
    await control.goto(
      english
        ? 'https://en.wikipedia.org/wiki/Time_management'
        : 'https://zh.wikipedia.org/wiki/%E6%97%B6%E9%97%B4%E7%AE%A1%E7%90%86',
      { waitUntil: 'load', timeout: 45000 }
    );
    await control.locator('h1').waitFor();
    await control.evaluate(() => document.fonts.ready);
    const intro = control
      .locator('p')
      .filter({ hasText: english ? 'Time management is' : '时间管理就是' })
      .first();
    await control.mouse.wheel(
      0,
      (await intro.evaluate(element => element.getBoundingClientRect().top)) - 28
    );
    await control.waitForFunction(() => scrollY > 200);
    await control.screenshot({ path: join(output, 'main-research.png') });
    await writeFile(
      join(output, 'main-research.json'),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          url: control.url(),
          title: await control.title(),
          viewport: await control.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
            dpr: devicePixelRatio
          })),
          scrollY: await control.evaluate(() => scrollY),
          browser: evidence.browser,
          sha256: createHash('sha256')
            .update(await readFile(join(output, 'main-research.png')))
            .digest('hex'),
          note: 'Real desktop Wikipedia time-management article, separate temporary browser context, no user account.'
        },
        null,
        2
      ) + '\n'
    );
    await control.goto(evidence.mainPage.url, { waitUntil: 'load', timeout: 45000 });
    await capture('welcome');
    for (const [name, url] of [
      ['ai-chatgpt', 'https://chatgpt.com/'],
      ['wiki', articleUrl],
      ...(!english
        ? [
            [
              'search',
              'https://www.google.com/search?q=%E7%95%AA%E8%8C%84%E5%B7%A5%E4%BD%9C%E6%B3%95&hl=zh-CN'
            ]
          ]
        : [])
    ]) {
      await panel.fill('#address', url);
      await panel.press('Enter');
      let frame;
      let rendered;
      for (let attempt = 0; attempt < 3 && !frame; attempt++) {
        try {
          const frameTarget = await poll(
            async () =>
              (await targets()).find(
                t =>
                  t.type === 'iframe' &&
                  (name === 'search'
                    ? /^https:\/\/www\.google\./.test(t.url)
                    : new URL(t.url).hostname === new URL(url).hostname)
              ),
            `${name} frame`
          );
          const candidate = await attachTarget(root, frameTarget.targetId, {
            errors: [],
            warnings: []
          });
          attached.push(candidate);
          rendered = await poll(async () => {
            const value = await candidate.evaluate(
              '({url:location.href,title:document.title,text:document.body.innerText.slice(0,450)})'
            );
            if (/\/sorry\/|recaptcha|unusual traffic|not a robot/i.test(value.url + value.text))
              return false;
            const expected =
              name === 'ai-chatgpt'
                ? /ChatGPT/.test(value.title) &&
                  /你想|询问|聊天|What can|Ask|Chat with/.test(value.text)
                : (english ? /Pomodoro/i : /番茄工作法/).test(value.title);
            return expected && value.text.length > 50 && value;
          }, `${name} rendered content`);
          frame = candidate;
        } catch (error) {
          if (attempt === 2) throw error;
          console.log(`Retry ${name}: ${error.message}`);
          await panel.click('#reload');
        }
      }
      assert(frame && rendered, `No verified content for ${name}`);
      console.log(`${name}: ${rendered.title}`);
      if (name === 'ai-chatgpt') {
        const before = await frame.evaluate('performance.timeOrigin');
        const another = await context.newPage();
        await another.goto('about:blank');
        await another.close();
        await control.bringToFront();
        assert.equal(await frame.evaluate('performance.timeOrigin'), before);
        evidence.aiRetainedAcrossTabSwitch = true;
      }
      await new Promise(r => setTimeout(r, 4000));
      await panel.evaluate('document.activeElement?.blur()');
      await capture(name, { resolvedUrl: rendered.url, title: rendered.title });
    }
  } else {
    await capture('welcome');
  }

  // Explicit demo favorites use public sites. This initializes genuine product data;
  // all visible controls, icon fallbacks and tooltips are rendered by the extension.
  const demoFavorites = [
    ['https://chatgpt.com/', 'ChatGPT'],
    [articleUrl, english ? 'Pomodoro Technique — Wikipedia' : '番茄工作法 — 维基百科'],
    ['https://www.google.com/', 'Google'],
    ['https://github.com/', 'GitHub'],
    ['https://developer.mozilla.org/', 'MDN Web Docs'],
    ['https://developer.chrome.com/', 'Chrome for Developers'],
    ['https://www.figma.com/', 'Figma'],
    ['https://www.notion.so/', 'Notion']
  ];
  // Visit public demo sites in ordinary temporary tabs so Chrome can cache their
  // real favicons. Do not substitute icon images or alter the captured interface.
  evidence.demoSiteVisits = await Promise.all(
    demoFavorites.map(async ([url]) => {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(resolve => setTimeout(resolve, 1800));
        const resolved = new URL(page.url());
        return { url, documentLoaded: true, resolvedPage: resolved.origin + resolved.pathname };
      } catch (error) {
        return { url, documentLoaded: false, error: error.message.split('\n')[0] };
      } finally {
        await page.close();
      }
    })
  );
  evidence.demoSiteVisitsNote =
    'Temporary public-page visits only prime Chrome favicon cache. A loaded document is not proof of website compatibility; challenge pages may load. Unavailable icons retain Chrome defaults. No demo visit was used as a website-content screenshot.';
  await control.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await control.bringToFront();
  for (const [url, title] of demoFavorites.toReversed()) {
    await panel.evaluate(`chrome.windows.getCurrent().then(window =>
      chrome.runtime.sendMessage({ type: 'PANEL_NAVIGATE', windowId: window.id, input: ${JSON.stringify(url)} }))`);
    const result = await panel.evaluate(`chrome.windows.getCurrent().then(window =>
      chrome.runtime.sendMessage({ type: 'PANEL_ADD_FAVORITE', windowId: window.id,
        url: ${JSON.stringify(url)}, title: ${JSON.stringify(title)} }))`);
    assert(result.ok, 'Favorite saved');
  }
  if (await panel.evaluate("document.querySelector('#empty').hidden")) {
    await panel.click('#more');
    await panel.click('#close-page');
  }
  await poll(
    () =>
      panel.evaluate(
        "document.querySelectorAll('.favorite-open').length === 8 && !document.querySelector('#empty').hidden"
      ),
    'favorite grid'
  );
  await new Promise(r => setTimeout(r, 1500));
  await panel.evaluate('document.activeElement?.blur()');
  await capture('favorites', {
    setup:
      'Eight demo favorites of public websites saved through the extension message API; no webpage content or UI replaced.'
  });
  const hover = await panel.evaluate(`(() => {
    const box = document.querySelectorAll('.favorite-open')[1].getBoundingClientRect();
    return {x: box.x + box.width / 2, y: box.y + box.height / 2};
  })()`);
  await panel.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hover });
  await poll(
    () => panel.evaluate("document.querySelector('#favorite-tooltip').matches(':popover-open')"),
    'favorite tooltip'
  );
  await panel.evaluate(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  );
  await capture('favorites-hover', {
    setup: 'Real hover over the Wikipedia favorite; title and complete saved URL.'
  });
  await panel.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 40 });
  await panel.fill('#address', articleUrl);
  await panel.press('Enter');
  const wikiTarget = await poll(
    async () =>
      (await targets()).find(t => t.type === 'iframe' && t.url.includes('wikipedia.org/wiki/')),
    'Wikipedia frame'
  );
  const wiki = await attachTarget(root, wikiTarget.targetId, { errors: [], warnings: [] });
  attached.push(wiki);
  await poll(async () => {
    const content = await wiki.evaluate(
      '({title: document.title, text: document.body?.innerText})'
    );
    return /Pomodoro|番茄工作法/.test(content.title) && content.text.length > 200;
  }, 'Wikipedia rendered');
  await new Promise(r => setTimeout(r, 1500));
  await panel.evaluate('document.activeElement?.blur()');
  await panel.click('#recent');
  await poll(
    () => panel.evaluate("document.querySelector('#recent-menu').matches(':popover-open')"),
    'recent menu open'
  );
  await capture('recent');
  await panel.press('Escape');
  await panel.click('#more');
  await poll(
    () => panel.evaluate("document.querySelector('#more-menu').matches(':popover-open')"),
    'more menu open'
  );
  await capture('more-light');
  await panel.evaluate('document.querySelector(\'[data-theme-value="dark"]\').click()');
  await poll(
    () => panel.evaluate("document.documentElement.dataset.theme === 'dark'"),
    'dark theme applied'
  );
  await panel.click('#more');
  await poll(
    () => panel.evaluate("document.querySelector('#more-menu').matches(':popover-open')"),
    'dark more menu open'
  );
  await capture('more-dark');
  await saveEvidence();
} finally {
  attached.forEach(t => t.dispose());
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
