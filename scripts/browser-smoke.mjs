import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { attachTarget, poll } from './browser/cdp.mjs';
import { checkTabPages } from './browser/tab-pages.mjs';

const rootPath = fileURLToPath(new URL('../dist/', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url)));
const locale = process.env.QA_LOCALE || 'en';
const supportedLocales = ['en', 'zh-CN', 'zh-TW', 'ja', 'de', 'fr', 'es'];
assert(
  supportedLocales.includes(locale),
  `QA_LOCALE must be one of ${supportedLocales.join(', ')}`
);
const catalog = JSON.parse(
  await readFile(
    new URL(`../dist/_locales/${locale.replace('-', '_')}/messages.json`, import.meta.url)
  )
);
const fixture = await readFile(new URL('./browser/fixture.html', import.meta.url));
const diagnostics = { errors: [], warnings: [] };
const profile = await mkdtemp(join(tmpdir(), 'sidebrowser-profile-'));
const output = process.env.QA_OUTPUT_DIR
  ? resolve(process.env.QA_OUTPUT_DIR)
  : await mkdtemp(join(tmpdir(), 'sidebrowser-qa-'));
await mkdir(output, { recursive: true });
const pass = label => console.log(`PASS ${label}`);
let slowResponseFinished = false;
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Frame-Options', 'DENY');
  if (request.url === '/redirect') {
    response.writeHead(302, { Location: '/landing' });
    response.end();
  } else if (request.url === '/slow-close') {
    setTimeout(() => {
      response.end(fixture);
      slowResponseFinished = true;
    }, 1500);
  } else response.end(fixture);
});
let context;
let root;
let panel;
let extension;
const attached = new Map();

async function attach(targetId) {
  if (!attached.has(targetId))
    attached.set(targetId, await attachTarget(root, targetId, diagnostics));
  return attached.get(targetId);
}
const targets = async () => (await root.send('Target.getTargets')).targetInfos;
const state = (api = panel) =>
  api.evaluate(`chrome.windows.getCurrent().then(window =>
  chrome.runtime.sendMessage({ type: 'PANEL_READY', windowId: window.id })).then(response => {
    if (!response.ok) throw new Error(response.error);
    const { sourceTabId, ...page } = response.data;
    return page;
  })`);
const recents = (api = panel) =>
  api.evaluate("[...document.querySelectorAll('.recent-open')].map(button => button.dataset.url)");
const menuOpen = () =>
  panel.evaluate("document.querySelector('#recent-menu').matches(':popover-open')");
async function closeMenu() {
  if (await menuOpen()) await panel.press('Escape');
}
async function screenshot(name) {
  const result = await panel.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, `${name}.png`), Buffer.from(result.data, 'base64'));
}
async function frameAt(url) {
  const target = await poll(
    async () => (await targets()).find(item => item.type === 'iframe' && item.url === url),
    'iframe destination'
  );
  const frame = await attach(target.targetId);
  await poll(() => frame.evaluate('Boolean(window.token)'), 'fixture ready');
  return frame;
}
async function loaded(url) {
  await poll(async () => (await state()).url === url, 'saved navigation');
  const frame = await frameAt(url);
  await poll(
    () =>
      panel.evaluate(
        "document.querySelector('#notice').hidden && document.querySelector('#empty').hidden"
      ),
    'visible webpage'
  );
  return frame;
}
async function navigate(url, destination = url) {
  await closeMenu();
  await panel.fill('#address', url);
  await panel.press('Enter');
  await loaded(destination);
  await poll(async () => (await recents())[0] === url, 'recent entry rendered');
}
async function launch() {
  let executablePath = process.env.CHROME_PATH || chromium.executablePath();
  if (process.platform === 'darwin') {
    // macOS uses AppleLanguages for Chrome UI; Playwright args only accept flags.
    const quotedPath = `'${executablePath.replaceAll("'", "'\\''")}'`;
    executablePath = join(profile, 'launch-chrome.sh');
    await writeFile(
      executablePath,
      `#!/bin/sh\nexec ${quotedPath} -AppleLanguages '(${locale})' "$@"\n`,
      { mode: 0o700 }
    );
  }
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    viewport: null,
    args: [
      `--load-extension=${rootPath}`,
      `--disable-extensions-except=${rootPath}`,
      `--lang=${locale}`
    ],
    ignoreDefaultArgs: ['--disable-extensions']
  });
  context.setDefaultTimeout(15000);
  const observe = page => {
    page.on('pageerror', error => diagnostics.errors.push(error.message));
    page.on('console', event => {
      if (event.type() === 'error') diagnostics.errors.push(event.text());
      if (event.type() === 'warning') diagnostics.warnings.push(event.text());
    });
  };
  context.pages().forEach(observe);
  context.on('page', observe);
  await context.grantPermissions(['local-network-access']);
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  // URL.origin for extension schemes is "null" in Node.
  extension = worker.url().slice(0, worker.url().lastIndexOf('/'));
  root = await context.browser().newBrowserCDPSession();
  root.setMaxListeners(50);
  const workerTarget = (await targets()).find(item => item.url === worker.url());
  await attach(workerTarget.targetId);
  console.log(
    `Chrome ${context.browser().version()}, ${locale}; isolated profile; screenshots: ${output}`
  );
}
async function shutdown() {
  for (const target of attached.values()) target.dispose();
  attached.clear();
  await context?.close();
  context = null;
}
async function openPanel(windowId) {
  const before = new Set((await targets()).map(target => target.targetId));
  const control = await context.newPage();
  await control.goto(`${extension}/help.html`);
  const id =
    windowId ||
    (await control.evaluate(() => chrome.windows.getCurrent().then(window => window.id)));
  await control.evaluate(id => {
    const button = document.createElement('button');
    button.id = 'qa-open';
    button.textContent = 'Open sidebar';
    button.onclick = () => chrome.sidePanel.open({ windowId: id });
    document.body.prepend(button);
  }, id);
  await control.locator('#qa-open').click();
  const target = await poll(
    async () =>
      (await targets()).find(
        item => item.url === `${extension}/sidepanel.html` && !before.has(item.targetId)
      ),
    'native side panel'
  );
  const api = await attach(target.targetId);
  await poll(
    () => api.evaluate("Boolean(document.querySelector('#mode-label')?.textContent)"),
    'panel initialized'
  );
  await control.close();
  return api;
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  await launch();
  const help = await context.newPage();
  await help.goto(`${extension}/help.html`);
  await help.locator('.intro').filter({ hasText: catalog.helpIntro.message }).waitFor();
  assert.equal(await help.title(), catalog.helpTitle.message);
  assert.equal(await help.locator('html').getAttribute('lang'), catalog.documentLanguage.message);
  assert.equal(await help.locator('html').getAttribute('dir'), catalog.documentDirection.message);
  for (const [key, value] of await help
    .locator('[data-i18n]')
    .evaluateAll(elements => elements.map(element => [element.dataset.i18n, element.textContent])))
    assert.equal(value, catalog[key].message, `Help message: ${key}`);
  assert.equal(await help.locator('.intro').textContent(), catalog.helpIntro.message);
  assert(!(await help.locator('body').innerText()).includes(manifest.version));
  const helpSession = await context.newCDPSession(help);
  for (const width of [960, 320]) {
    await helpSession.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    assert(await help.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    await help.screenshot({ path: join(output, `help-${width}.png`) });
  }
  await helpSession.send('Emulation.clearDeviceMetricsOverride');
  const optionsOpened = context.waitForEvent('page');
  await help.evaluate(() => chrome.runtime.openOptionsPage());
  const options = await optionsOpened;
  await options.waitForURL(`${extension}/options.html`);
  assert.equal(manifest.options_ui.page, 'options.html');
  await poll(() => options.locator('#mode').isEnabled(), 'settings loaded');
  assert.equal(await options.title(), catalog.settingsTitle.message);
  assert.equal(
    await options.locator('html').getAttribute('lang'),
    catalog.documentLanguage.message
  );
  assert.equal(await options.locator('#mode').inputValue(), 'mobile');
  assert.equal(await options.locator('#theme').inputValue(), 'system');
  assert(await options.locator('#clear-recent').isDisabled());
  for (const [key, value] of await options
    .locator('[data-i18n]')
    .evaluateAll(elements => elements.map(element => [element.dataset.i18n, element.textContent])))
    assert.equal(value, catalog[key].message, `Settings message: ${key}`);
  const optionsSession = await context.newCDPSession(options);
  const chooseTheme = async theme => {
    await poll(() => options.locator('#theme').isEnabled(), 'appearance control ready');
    await options.locator('#theme').selectOption(theme);
    await poll(
      () =>
        options.evaluate(
          theme =>
            document.documentElement.dataset.theme === theme &&
            !document.querySelector('#theme').disabled,
          theme
        ),
      `appearance saved: ${theme}`
    );
  };
  for (const theme of ['light', 'dark']) {
    await chooseTheme(theme);
    await poll(
      () => help.evaluate(theme => document.documentElement.dataset.theme === theme, theme),
      'help theme synchronized'
    );
    assert.equal(
      await options.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
      theme === 'dark' ? 'rgb(24, 35, 47)' : 'rgb(247, 249, 252)'
    );
    for (const width of [960, 320]) {
      await optionsSession.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      assert(await options.evaluate(() => document.documentElement.scrollWidth === innerWidth));
      assert(
        await options
          .locator('.setting-row button, .setting-row select')
          .evaluateAll(elements =>
            elements.every(element => element.scrollWidth <= element.clientWidth)
          )
      );
      await options.screenshot({
        path: join(output, `settings-${theme}-${width}.png`),
        fullPage: true
      });
      await helpSession.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      assert(await help.evaluate(() => document.documentElement.scrollWidth === innerWidth));
      await help.screenshot({ path: join(output, `help-${theme}-${width}.png`), fullPage: true });
    }
  }
  await helpSession.send('Emulation.clearDeviceMetricsOverride');
  await optionsSession.send('Emulation.clearDeviceMetricsOverride');
  await options.reload();
  await poll(() => options.locator('#theme').isEnabled(), 'saved appearance restored');
  assert.equal(await options.locator('#theme').inputValue(), 'dark');
  await chooseTheme('system');
  await options.locator('#mode').selectOption('desktop');
  await poll(
    () =>
      options
        .locator('#settings-status')
        .textContent()
        .then(text => text === catalog.settingsSaved.message),
    'mode saved'
  );
  await options.reload();
  await poll(
    () =>
      options
        .locator('#mode')
        .inputValue()
        .then(value => value === 'desktop'),
    'saved setting restored'
  );
  await poll(() => options.locator('#mode').isEnabled(), 'settings restored');
  await options.locator('#mode').selectOption('mobile');
  await poll(
    () =>
      options
        .locator('#settings-status')
        .textContent()
        .then(text => text === catalog.settingsSaved.message),
    'mobile saved'
  );
  const shortcutsOpened = context.waitForEvent('page');
  await options.locator('#manage-shortcut').click();
  const shortcuts = await shortcutsOpened;
  await shortcuts.waitForURL('chrome://extensions/shortcuts');
  await shortcuts.close();
  await options.locator('a[href="help.html"]').click();
  await options.waitForURL(`${extension}/help.html`);
  assert.equal(await options.title(), catalog.helpTitle.message);
  await options.locator('a[href="options.html"]').click();
  await options.waitForURL(`${extension}/options.html`);
  await poll(() => options.locator('#mode').isEnabled(), 'settings return link');
  pass(
    'Chrome options entry, localized settings, saved mode, shortcuts, help navigation and 960px/320px layouts'
  );
  await help.close();
  pass('Localized help without version display, document language and 960px/320px layouts');
  panel = await openPanel();
  assert.equal(await panel.evaluate('location.href'), `${extension}/sidepanel.html`);
  assert.equal(await panel.evaluate('document.title'), catalog.extensionName.message);
  assert.equal(
    await panel.evaluate('document.documentElement.lang'),
    catalog.documentLanguage.message
  );
  assert.equal(
    await panel.evaluate('chrome.runtime.getManifest().description'),
    catalog.extensionDescription.message
  );
  assert.equal(await panel.evaluate('chrome.action.getTitle({})'), catalog.openSidePanel.message);
  assert.deepEqual(
    await panel.evaluate(`(() => {
      const messages = [];
      for (const element of document.querySelectorAll('[data-i18n]'))
        messages.push([element.dataset.i18n, element.textContent]);
      for (const attribute of ['title', 'placeholder', 'aria-label']) {
        const marker = 'data-i18n-' + attribute;
        for (const element of document.querySelectorAll('[' + marker + ']'))
          messages.push([element.getAttribute(marker), element.getAttribute(attribute)]);
      }
      return messages.filter(([key, value]) => value !== chrome.i18n.getMessage(key));
    })()`),
    []
  );
  assert((await panel.evaluate('document.body.innerText')).includes(catalog.emptyTitle.message));
  assert.deepEqual(
    await panel.evaluate(
      "[...document.querySelector('header').children].map(element => element.id || element.className)"
    ),
    ['current', 'toolbar-separator', 'back', 'forward', 'reload', 'navigate', 'more']
  );
  pass('Panel identity, localized empty state and toolbar order');
  await screenshot('native-empty');
  await poll(
    () => panel.evaluate('!document.querySelector("#empty-current").disabled'),
    'welcome action ready'
  );
  for (const theme of ['light', 'dark']) {
    await chooseTheme(theme);
    await poll(
      () => panel.evaluate(`document.documentElement.dataset.theme === '${theme}'`),
      'welcome appearance synchronized'
    );
    await screenshot(`welcome-native-${theme}`);
    for (const width of [320, 480]) {
      await panel.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 640,
        deviceScaleFactor: 1,
        mobile: false
      });
      assert(
        await panel.evaluate(`(() => {
          const empty = document.querySelector('#empty');
          return document.documentElement.scrollWidth === innerWidth &&
            empty.scrollWidth === empty.clientWidth &&
            [...empty.querySelectorAll('button, h1, p, li, a')].every(element => {
              const rect = element.getBoundingClientRect();
              return rect.x >= 0 && rect.right <= innerWidth &&
                element.scrollWidth <= element.clientWidth;
            });
        })()`),
        `Welcome layout fits ${width}px in ${theme}`
      );
      await screenshot(`welcome-${theme}-${width}`);
    }
    await panel.send('Emulation.clearDeviceMetricsOverride');
  }
  await chooseTheme('system');
  await panel.send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 280,
    deviceScaleFactor: 1,
    mobile: false
  });
  assert(
    await panel.evaluate(`(() => {
      const empty = document.querySelector('#empty');
      return empty.scrollHeight > empty.clientHeight && getComputedStyle(empty).overflowY === 'auto';
    })()`)
  );
  const welcomeHelpOpened = context.waitForEvent('page');
  await panel.click('#empty a');
  const welcomeHelp = await welcomeHelpOpened;
  await welcomeHelp.waitForURL(`${extension}/help.html`);
  await welcomeHelp.locator('h1').filter({ hasText: catalog.helpHeading.message }).waitFor();
  await welcomeHelp.close();
  await panel.send('Emulation.clearDeviceMetricsOverride');
  const blankSource = context.pages()[0];
  await blankSource.goto('about:blank');
  await blankSource.bringToFront();
  await panel.click('#empty-current');
  await poll(
    () =>
      panel.evaluate(
        `document.querySelector('#notice span').textContent === ${JSON.stringify(catalog.errorCurrentPage.message)} &&
         !document.querySelector('#empty-current').disabled && !document.querySelector('#empty').hidden`
      ),
    'unavailable current page keeps welcome actions usable'
  );
  await panel.click('#empty-address');
  assert.equal(await panel.evaluate('document.activeElement.id'), 'address');
  assert.equal((await state()).url, '');
  pass('Welcome actions, guide link, light/dark 320px/480px layouts and short-window scrolling');
  await panel.fill('#address', 'ftp://example.com');
  await panel.press('Enter');
  await poll(
    () =>
      panel.evaluate(
        `!document.querySelector('#notice').hidden &&
         document.querySelector('#notice span').textContent === ${JSON.stringify(catalog.errorUnsupportedScheme.message)}`
      ),
    'localized address error replaces the previous notice'
  );
  assert.equal(
    await panel.evaluate('document.querySelector("#notice span").textContent'),
    catalog.errorUnsupportedScheme.message
  );
  pass('Unsupported address displays the translated error');

  const source = context.pages()[0];
  await source.goto(`${base}/first`);
  await source.bringToFront();
  await panel.click('#empty-current');
  let inner = await loaded(`${base}/first`);
  assert(await panel.evaluate('document.querySelector("#empty").hidden'));
  await inner.fill('#entry', 'Keep this input');
  const originalToken = await inner.evaluate('window.token');
  const otherTab = await context.newPage();
  await otherTab.goto(`${base}/other-tab`);
  await otherTab.bringToFront();
  await source.close();
  assert.equal(await inner.evaluate('window.token'), originalToken);
  assert.equal(await inner.evaluate("document.querySelector('#entry').value"), 'Keep this input');
  pass('Opening current page, switching tabs and closing source preserve the live iframe');

  const beforeTheme = await state();
  const tabTheme = await otherTab.evaluate(
    () => matchMedia('(prefers-color-scheme: dark)').matches
  );
  const checkTheme = async dark => {
    await poll(
      () => inner.evaluate(`matchMedia('(prefers-color-scheme: dark)').matches === ${dark}`),
      'embedded webpage color preference'
    );
    const color = dark ? 'rgb(32, 37, 33)' : 'rgb(255, 255, 255)';
    await poll(
      () =>
        inner.evaluate(
          `getComputedStyle(document.body).backgroundColor === ${JSON.stringify(color)}`
        ),
      'embedded webpage rendered theme'
    );
    assert.equal(
      await panel.evaluate('getComputedStyle(document.body).backgroundColor'),
      dark ? 'rgb(24, 35, 47)' : 'rgb(247, 249, 252)'
    );
    assert.equal(await inner.evaluate('window.token'), originalToken);
    assert.equal(await inner.evaluate("document.querySelector('#entry').value"), 'Keep this input');
    assert.deepEqual(await state(), beforeTheme);
    assert.equal(
      await otherTab.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches),
      tabTheme
    );
  };
  await panel.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }]
  });
  await chooseTheme('dark');
  await checkTheme(true);
  await screenshot('native-dark-webpage');
  await panel.click('#recent');
  await screenshot('native-dark-recent');
  await closeMenu();
  await panel.click('#more');
  await screenshot('native-dark-more');
  await panel.click('#settings');
  assert.equal(
    await panel.evaluate("document.querySelector('#more-menu').matches(':popover-open')"),
    false
  );
  assert.equal(await options.url(), `${extension}/options.html`);
  await panel.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  });
  await chooseTheme('light');
  await checkTheme(false);
  await screenshot('native-light-webpage');
  await chooseTheme('system');
  await checkTheme(true);
  await panel.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }]
  });
  await checkTheme(false);
  assert(await inner.evaluate('window.themeUpdates >= 3'));
  for (const theme of ['dark', 'light', 'system']) {
    await panel.click('#more');
    await panel.click(`[data-theme-value="${theme}"]`);
    await poll(
      () =>
        options
          .locator('#theme')
          .inputValue()
          .then(value => value === theme),
      'menu appearance synchronized back to settings'
    );
    assert.equal(
      await panel.evaluate(
        `document.querySelector('[data-theme-value="${theme}"]').getAttribute('aria-pressed')`
      ),
      'true'
    );
    assert.equal(
      await panel.evaluate(
        "document.querySelectorAll('[data-theme-value][aria-pressed=true]').length"
      ),
      1
    );
    assert.equal(
      await panel.evaluate("document.querySelector('#more-menu').matches(':popover-open')"),
      false
    );
    await checkTheme(theme === 'dark');
  }
  await panel.send('Emulation.setEmulatedMedia', { features: [] });
  pass(
    'Appearance follows system changes, overrides light/dark, updates iframe CSS and media listeners without reload or history changes; ordinary tabs unchanged'
  );

  const session = await context.newCDPSession(otherTab);
  const workerBeforeStop = (await targets()).find(
    target => target.url === `${extension}/background.js`
  ).targetId;
  await attached
    .get(workerBeforeStop)
    .evaluate("globalThis.__sidebrowserQaWorkerToken = 'original'");
  await attached.get(workerBeforeStop).detach();
  attached.delete(workerBeforeStop);
  let workerStopped = false;
  let workerRestarted = false;
  const observeWorker = ({ versions }) => {
    for (const version of versions) {
      if (version.scriptURL !== `${extension}/background.js`) continue;
      if (version.runningStatus === 'stopped') workerStopped = true;
      if (workerStopped && version.runningStatus === 'running') workerRestarted = true;
    }
  };
  session.on('ServiceWorker.workerVersionUpdated', observeWorker);
  await session.send('ServiceWorker.enable');
  await session.send('ServiceWorker.stopAllWorkers');
  // Chrome can reuse a CDP target ID across worker lifetimes. Observe real states.
  await poll(() => workerRestarted, 'automatic worker reconnect');
  session.off('ServiceWorker.workerVersionUpdated', observeWorker);
  assert.equal((await state()).url, `${base}/first`);
  assert.equal(await inner.evaluate('window.token'), originalToken);
  assert.equal(await inner.evaluate("document.querySelector('#entry').value"), 'Keep this input');
  const recoveredWorker = (await targets()).find(
    target => target.url === `${extension}/background.js`
  );
  const recovered = await attach(recoveredWorker.targetId);
  assert.equal(await recovered.evaluate('globalThis.__sidebrowserQaWorkerToken'), undefined);
  pass('Worker stop/reconnect preserves document instance and input');

  await inner.click('#next');
  await loaded(`${base}/next`);
  assert.deepEqual(await recents(), [`${base}/first`]);
  await panel.click('#back');
  await loaded(`${base}/first`);
  await panel.click('#forward');
  inner = await loaded(`${base}/next`);
  const beforeReload = await inner.evaluate('window.token');
  await panel.click('#reload');
  await poll(
    () =>
      inner.evaluate(`Boolean(window.token) && window.token !== ${JSON.stringify(beforeReload)}`),
    'reload creates new document'
  );
  await navigate(`${base}/redirect`, `${base}/landing`);
  await poll(
    async () => (await state()).recentTitles[`${base}/redirect`] === 'SideBrowser QA /landing',
    'redirect title association'
  );
  assert.deepEqual(await recents(), [`${base}/redirect`, `${base}/first`]);
  pass('Internal navigation, history, reload and redirect metadata retain recent-list semantics');

  inner = await frameAt(`${base}/landing`);
  const beforeMode = await inner.evaluate('window.token');
  await panel.click('#more');
  await panel.click('#mode');
  await poll(async () => (await state()).mode === 'desktop', 'desktop preference');
  assert.equal(
    await panel.evaluate('document.querySelector("#mode-label").textContent'),
    catalog.switchToMobile.message
  );
  await poll(
    () =>
      inner.evaluate(
        `window.token !== ${JSON.stringify(beforeMode)} && !navigator.userAgent.includes('Android')`
      ),
    'desktop reload'
  );
  await panel.click('#more');
  await panel.click('#mode');
  await poll(() => inner.evaluate("navigator.userAgent.includes('Android')"), 'mobile reload');
  assert.equal(
    await panel.evaluate('document.querySelector("#mode-label").textContent'),
    catalog.switchToDesktop.message
  );
  assert.deepEqual(await recents(), [`${base}/redirect`, `${base}/first`]);
  pass('Mobile/desktop switching reloads deliberately without adding recent entries');

  await navigate(`${base}/second`);
  inner = await frameAt(`${base}/second`);
  await inner.evaluate("document.title = 'Updated fixture title'");
  await poll(
    () =>
      panel.evaluate(
        "document.querySelector('.recent-label').textContent === 'Updated fixture title'"
      ),
    'dynamic title rendering'
  );
  await panel.click('#recent');
  await panel.evaluate("document.querySelector('.recent-open').focus()");
  await panel.press('End');
  assert(
    await panel.evaluate(
      "document.activeElement === document.querySelector('.recent-item:last-child .recent-open')"
    )
  );
  await panel.press('Home');
  await panel.press('ArrowDown');
  assert(
    await panel.evaluate(
      "document.activeElement === document.querySelector('.recent-item:nth-child(2) .recent-open')"
    )
  );
  await panel.click('.recent-item:nth-child(2) .recent-remove');
  await poll(async () => (await recents()).length === 2, 'single delete');
  assert(await menuOpen());
  assert(
    await panel.evaluate(
      "document.activeElement === document.querySelector('.recent-item:nth-child(2) .recent-remove')"
    )
  );
  await panel.click('.recent-item:last-child .recent-open');
  await loaded(`${base}/first`);
  assert.equal(await menuOpen(), false);
  assert.equal((await recents())[0], `${base}/first`);
  pass('Dynamic titles, keyboard navigation, deletion focus and recent selection');

  await panel.click('#recent');
  const nativeWidth = await panel.evaluate('innerWidth');
  await screenshot('native-recent');
  for (const width of [nativeWidth, 480, 320]) {
    if (width !== nativeWidth)
      await panel.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 680,
        deviceScaleFactor: 1,
        mobile: false
      });
    const geometry = await panel.evaluate(`(() => {
      const menu = document.querySelector('#recent-menu');
      const box = menu.getBoundingClientRect();
      return { width: innerWidth, scroll: document.documentElement.scrollWidth,
        header: document.querySelector('header').getBoundingClientRect().height,
        contained: box.x >= 0 && box.right <= innerWidth && menu.scrollWidth === menu.clientWidth,
        controls: [...document.querySelectorAll('header button, header input')].every(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.x >= 0 && rect.right <= innerWidth;
        }) };
    })()`);
    assert.deepEqual(geometry, {
      width,
      scroll: width,
      header: 36,
      contained: true,
      controls: true
    });
    await screenshot(`simulated-${width}`);
    await closeMenu();
    await panel.click('#more');
    assert(
      await panel.evaluate(`(() => {
      const menu = document.querySelector('#more-menu');
      const box = menu.getBoundingClientRect();
      return box.x >= 0 && box.right <= innerWidth && menu.scrollWidth === menu.clientWidth &&
        [...menu.querySelectorAll('button')].every(button => {
          const label = button.querySelector('span');
          const rect = label.getBoundingClientRect();
          const icon = button.querySelector('svg').getBoundingClientRect();
          return icon.width === 15 && icon.height === 15 &&
            button.scrollWidth === button.clientWidth && rect.right <= box.right - 4;
        });
    })()`),
      `More menu labels fit at ${width}px`
    );
    await screenshot(`more-${width}`);
    await panel.press('Escape');
    await panel.click('#recent');
  }
  await panel.send('Emulation.clearDeviceMetricsOverride');
  await closeMenu();
  await panel.click('#recent');
  inner = await frameAt(`${base}/first`);
  await inner.click('#entry');
  await poll(async () => !(await menuOpen()), 'iframe click closes menu');
  const moreOpen = () =>
    panel.evaluate("document.querySelector('#more-menu').matches(':popover-open')");
  await panel.click('#more');
  assert(await moreOpen());
  await panel.click('#theme-heading');
  assert(await moreOpen());
  await panel.click('#address');
  await poll(async () => !(await moreOpen()), 'toolbar click closes more menu');
  await panel.click('#more');
  await inner.click('#entry');
  await poll(async () => !(await moreOpen()), 'iframe click closes more menu');
  await panel.click('#more');
  await panel.click('#more');
  assert.equal(await moreOpen(), false);
  pass(`Native panel ${nativeWidth}px; 480px/320px simulated layouts and iframe dismissal`);

  const secondWindow = await panel.evaluate(
    `chrome.windows.create({ url: ${JSON.stringify(`${base}/second-window`)}, type: 'normal' })`
  );
  const secondPanel = await openPanel(secondWindow.id);
  const secondUrl = (await state(secondPanel)).url;
  await navigate(`${base}/cross-window`);
  await poll(
    async () => (await recents(secondPanel))[0] === `${base}/cross-window`,
    'cross-window broadcast'
  );
  assert.equal((await state(secondPanel)).url, secondUrl);
  inner = await frameAt(`${base}/cross-window`);
  const beforeClear = await inner.evaluate('window.token');
  await inner.fill('#entry', 'Keep while clearing');
  await panel.click('#recent');
  await panel.click('#clear-recent');
  await poll(
    async () => !(await recents()).length && !(await recents(secondPanel)).length,
    'clear broadcast'
  );
  assert.equal((await state()).url, `${base}/cross-window`);
  assert.equal((await state(secondPanel)).url, secondUrl);
  assert.equal(await inner.evaluate('window.token'), beforeClear);
  assert.equal(
    await inner.evaluate("document.querySelector('#entry').value"),
    'Keep while clearing'
  );
  assert(
    await panel.evaluate(
      "document.querySelector('#clear-recent').disabled && !document.querySelector('#recent-empty').hidden"
    )
  );
  pass('Shared recent updates/clearing preserve independent window URLs and live page');

  await navigate(`${base}/settings-clear`);
  const settingsBefore = await state();
  const settingsSecondBefore = await state(secondPanel);
  const themeFrame = await frameAt(`${base}/settings-clear`);
  const themeToken = await themeFrame.evaluate('window.token');
  await chooseTheme('dark');
  for (const api of [panel, secondPanel]) {
    await poll(
      () => api.evaluate("document.documentElement.dataset.theme === 'dark'"),
      'appearance synchronized across windows'
    );
    assert.equal(
      await api.evaluate('getComputedStyle(document.body).backgroundColor'),
      'rgb(24, 35, 47)'
    );
  }
  assert.equal(await themeFrame.evaluate('window.token'), themeToken);
  assert.deepEqual(await state(), settingsBefore);
  assert.deepEqual(await state(secondPanel), settingsSecondBefore);
  await poll(
    () =>
      options
        .locator('#recent-count')
        .textContent()
        .then(text => text === catalog.settingsRecentCount.message.replace('$count$', '1')),
    'settings count synchronized'
  );
  await options.locator('#mode').selectOption('desktop');
  await poll(
    async () => (await state()).mode === 'desktop' && (await state(secondPanel)).mode === 'desktop',
    'settings mode synchronized across windows'
  );
  inner = await loaded(`${base}/settings-clear`);
  await poll(
    () => inner.evaluate("!navigator.userAgent.includes('Android')"),
    'settings mode applied to webpage'
  );
  assert.equal((await state()).url, settingsBefore.url);
  assert.deepEqual((await state()).history, settingsBefore.history);
  assert.equal((await state(secondPanel)).url, settingsSecondBefore.url);
  assert.deepEqual((await state(secondPanel)).history, settingsSecondBefore.history);
  await panel.click('#more');
  await panel.click('#mode');
  await poll(
    () =>
      options
        .locator('#mode')
        .inputValue()
        .then(value => value === 'mobile'),
    'panel mode synchronized back to settings'
  );
  await poll(
    () => inner.evaluate("navigator.userAgent.includes('Android')"),
    'panel mobile reload'
  );
  const settingsToken = await inner.evaluate('window.token');
  await inner.fill('#entry', 'Keep while clearing in settings');
  await options.locator('#clear-recent').click();
  assert(await options.locator('#clear-confirmation').isVisible());
  await options.locator('#cancel-clear').click();
  assert.deepEqual(await recents(), [`${base}/settings-clear`]);
  assert(await options.locator('#clear-confirmation').isHidden());
  await options.locator('#clear-recent').click();
  await options.screenshot({ path: join(output, 'settings-confirmation.png'), fullPage: true });
  await options.locator('#confirm-clear').click();
  await poll(
    async () => !(await recents()).length && !(await recents(secondPanel)).length,
    'settings clear synchronized'
  );
  assert.equal(await inner.evaluate('window.token'), settingsToken);
  assert.equal(
    await inner.evaluate("document.querySelector('#entry').value"),
    'Keep while clearing in settings'
  );
  assert(await options.locator('#clear-recent').isDisabled());
  assert.equal((await state()).url, settingsBefore.url);
  assert.equal((await state(secondPanel)).url, settingsSecondBefore.url);
  await options.reload();
  await poll(() => options.locator('#mode').isEnabled(), 'settings reopened after clear');
  assert(await options.locator('#clear-recent').isDisabled());
  await options.locator('#mode').selectOption('desktop');
  await poll(async () => (await state()).mode === 'desktop', 'desktop saved for restart');
  pass(
    'Settings and panel synchronize in both directions; cancel/confirm clear preserves live pages and window histories'
  );

  await navigate(`${base}/persisted`);
  await shutdown();
  await launch();
  panel = await openPanel();
  await loaded(`${base}/persisted`);
  await poll(
    () => panel.evaluate("document.documentElement.dataset.theme === 'dark'"),
    'appearance restored after restart'
  );
  const restoredFrame = await frameAt(`${base}/persisted`);
  assert(await restoredFrame.evaluate("matchMedia('(prefers-color-scheme: dark)').matches"));
  assert.deepEqual(await recents(), [`${base}/persisted`]);
  assert.equal((await state()).mode, 'desktop');
  pass('Full browser restart restores persisted recent entries');

  const beforeClose = await state();
  const panelDocument = await panel.evaluate('performance.timeOrigin');
  const closeWindow = await panel.evaluate(
    `chrome.windows.create({ url: ${JSON.stringify(`${base}/close-other-window`)}, type: 'normal' })`
  );
  const closeOtherPanel = await openPanel(closeWindow.id);
  const otherBeforeClose = await state(closeOtherPanel);
  // Queue an old frame report behind the close operation, as a late navigation can be.
  await panel.evaluate(`document.querySelector('#close-page').addEventListener('click', () => {
    const source = document.querySelector('#web').contentWindow;
    window.dispatchEvent(new MessageEvent('message', {
      source, origin: ${JSON.stringify(base)}, data: {
        type: 'POCKET_LOCATION', url: ${JSON.stringify(`${base}/late-close`)},
        documentId: 'late-document', title: 'Late navigation', viewport: ['width=525']
      }
    }));
  }, { once: true })`);
  const assertClosed = async () => {
    await poll(async () => (await state()).url === '', 'closed page saved');
    await poll(
      () =>
        panel.evaluate(`!document.querySelector('#empty').hidden &&
        document.querySelector('#web').contentWindow.location.href === 'about:blank'`),
      'closed page unloaded'
    );
    assert(
      await panel.evaluate(`document.querySelector('#address').value === '' &&
      document.querySelector('#notice').hidden &&
      ['back', 'forward', 'reload', 'external', 'close-page'].every(id =>
        document.getElementById(id).disabled)`)
    );
    assert.deepEqual((await state()).history, []);
    assert.equal((await state()).historyIndex, -1);
  };
  await panel.click('#more');
  await screenshot('close-page-menu');
  await panel.click('#close-page');
  await assertClosed();
  assert.equal(await panel.evaluate('performance.timeOrigin'), panelDocument);
  assert.equal(await panel.evaluate('document.activeElement.id'), 'address');
  assert.equal(await moreOpen(), false);
  assert.deepEqual((await state()).recentUrls, beforeClose.recentUrls);
  assert.deepEqual((await state()).recentTitles, beforeClose.recentTitles);
  assert.deepEqual(await state(closeOtherPanel), otherBeforeClose);
  await screenshot('closed-page-native');
  // Reloading the panel and changing modes must keep an explicitly closed page empty.
  await panel.send('Page.reload');
  await assertClosed();
  await panel.click('#more');
  await panel.click('#mode');
  await poll(async () => (await state()).mode === 'mobile', 'empty page mode changed');
  await assertClosed();
  await panel.click('#recent');
  await panel.click('.recent-item:first-child .recent-open');
  await loaded(`${base}/persisted`);
  assert.deepEqual((await state()).history, [`${base}/persisted`]);
  assert.equal(await panel.evaluate("document.querySelector('#close-page').disabled"), false);

  // Close before a slow response arrives; its load event must not hide the welcome screen.
  await panel.fill('#address', `${base}/slow-close`);
  await panel.press('Enter');
  await poll(async () => (await state()).url === `${base}/slow-close`, 'pending page saved');
  await panel.click('#more');
  await panel.click('#close-page');
  await assertClosed();
  const closedRecents = await recents();
  await poll(() => slowResponseFinished, 'slow response completed after close');
  await assertClosed();
  await shutdown();
  await launch();
  panel = await openPanel();
  await assertClosed();
  assert.deepEqual(await recents(), closedRecents);
  await screenshot('closed-page-restored');
  pass(
    'Close unloads the page, rejects late navigation, preserves recents/other windows, reopens from recents and stays empty after restart'
  );
  await checkTabPages({
    context,
    panel,
    state,
    navigate,
    frameAt,
    loaded,
    screenshot,
    base,
    extension,
    catalog,
    targets,
    attach,
    attached
  });
  await shutdown();
  await launch();
  panel = await openPanel();
  assert.equal((await state()).tabId, null);
  await poll(
    () => panel.evaluate("!document.querySelector('#empty').hidden"),
    'empty shared page after restart'
  );
  assert.equal((await state()).url, '');
  assert.deepEqual((await state()).history, []);
  pass('Browser restart clears bindings and does not restore a page transferred out of sharing');
  assert.deepEqual(diagnostics.errors, []);
  const warnings = [...new Set(diagnostics.warnings)];
  assert(
    warnings.every(
      warning =>
        warning.includes('An iframe which has both allow-scripts and allow-same-origin') ||
        warning.includes('Permissions policy violation: unload')
    ),
    warnings.join('\n')
  );
  console.log('Known Chromium warnings:', warnings);
  pass('No runtime errors or unexpected console warnings');
} catch (error) {
  if (panel && context) await screenshot('failure').catch(() => {});
  console.error(error);
  console.error(diagnostics);
  process.exitCode = 1;
} finally {
  await shutdown();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
