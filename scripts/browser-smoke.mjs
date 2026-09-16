import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { attachTarget, poll } from './browser/cdp.mjs';

const rootPath = fileURLToPath(new URL('../', import.meta.url));
const locale = process.env.QA_LOCALE || 'en';
assert(['en', 'zh-CN'].includes(locale), 'QA_LOCALE must be en or zh-CN');
const catalog = JSON.parse(
  await readFile(
    new URL(`../_locales/${locale === 'en' ? 'en' : 'zh_CN'}/messages.json`, import.meta.url)
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
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Frame-Options', 'DENY');
  if (request.url === '/redirect') {
    response.writeHead(302, { Location: '/landing' });
    response.end();
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
    return response.data;
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
  panel = await openPanel();
  assert.equal(await panel.evaluate('location.href'), `${extension}/sidepanel.html`);
  assert.equal(await panel.evaluate('document.title'), catalog.extensionName.message);
  assert((await panel.evaluate('document.body.innerText')).includes(catalog.emptyTitle.message));
  assert.deepEqual(
    await panel.evaluate(
      "[...document.querySelector('header').children].map(element => element.id || element.className)"
    ),
    ['current', 'toolbar-separator', 'back', 'forward', 'reload', 'navigate', 'more']
  );
  pass('Panel identity, localized empty state and toolbar order');

  const source = context.pages()[0];
  await source.goto(`${base}/first`);
  await source.bringToFront();
  await panel.click('#current');
  let inner = await loaded(`${base}/first`);
  await inner.fill('#entry', 'Keep this input');
  const originalToken = await inner.evaluate('window.token');
  const otherTab = await context.newPage();
  await otherTab.goto(`${base}/other-tab`);
  await otherTab.bringToFront();
  await source.close();
  assert.equal(await inner.evaluate('window.token'), originalToken);
  assert.equal(await inner.evaluate("document.querySelector('#entry').value"), 'Keep this input');
  pass('Opening current page, switching tabs and closing source preserve the live iframe');

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
  for (const width of [480, 320]) {
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
  }
  await panel.send('Emulation.clearDeviceMetricsOverride');
  await closeMenu();
  await panel.click('#recent');
  inner = await frameAt(`${base}/first`);
  await inner.click('#entry');
  await poll(async () => !(await menuOpen()), 'iframe click closes menu');
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

  await navigate(`${base}/persisted`);
  await shutdown();
  await launch();
  panel = await openPanel();
  await loaded(`${base}/persisted`);
  assert.deepEqual(await recents(), [`${base}/persisted`]);
  pass('Full browser restart restores persisted recent entries');
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
