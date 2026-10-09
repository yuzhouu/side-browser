import assert from 'node:assert/strict';
import { join } from 'node:path';
import { poll } from './cdp.mjs';

export async function checkSitePreferences({
  panel,
  context,
  extension,
  state,
  navigate,
  loaded,
  frameAt,
  screenshot,
  base,
  output,
  openPanel
}) {
  const alias = base.replace('127.0.0.1', 'localhost');
  const options = await context.newPage();
  await options.goto(`${extension}/options.html`);
  await options.locator('#mode').selectOption('mobile');
  await poll(async () => (await state()).defaultMode === 'mobile', 'default narrow layout');
  const normal = await context.newPage();
  await normal.goto(`${base}/identity-normal`);
  const native = await normal.evaluate(() => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    mobile: navigator.userAgentData?.mobile
  }));
  await navigate(`${base}/identity-page`);
  let inner = await loaded(`${base}/identity-page`);
  const original = await inner.evaluate('window.token');
  await inner.fill('#entry', 'Preserve layout input');
  const identity = () =>
    inner.evaluate(
      `({ userAgent: navigator.userAgent, platform: navigator.platform, mobile: navigator.userAgentData?.mobile })`
    );
  assert.deepEqual(await identity(), native);
  assert.equal(await inner.evaluate('window.requestIdentity["user-agent"]'), native.userAgent);
  assert.equal(await inner.evaluate('window.initialIdentity.mobile'), false);
  assert(
    await inner.evaluate(
      `!Object.hasOwn(screen, 'width') && !Object.hasOwn(screen, 'height') && !Object.hasOwn(visualViewport, 'scale')`
    )
  );
  assert.equal(
    await inner.evaluate(
      `new Promise(resolve => { const w = new Worker('/identity-worker.js'); w.onmessage = event => { w.terminate(); resolve(event.data.userAgent); }; })`
    ),
    native.userAgent
  );
  await panel.click('#more');
  await panel.click('#mode');
  await poll(async () => (await state()).mode === 'desktop', 'site full width');
  assert.equal(await inner.evaluate('window.token'), original);
  await panel.click('#more');
  await panel.click('#mode');
  await poll(async () => (await state()).mode === 'mobile', 'site narrow layout');
  assert.equal(await inner.evaluate('window.token'), original);
  assert.equal(
    await inner.evaluate("document.querySelector('#entry').value"),
    'Preserve layout input'
  );
  assert.deepEqual(await identity(), native);
  const secondWindow = await panel.evaluate(
    `chrome.windows.create({ url: ${JSON.stringify(`${alias}/identity-window`)}, type: 'normal' })`
  );
  const secondPanel = await openPanel(secondWindow.id);
  await secondPanel.fill('#address', `${alias}/identity-other-window`);
  await secondPanel.press('Enter');
  await poll(
    async () => (await state(secondPanel)).url === `${alias}/identity-other-window`,
    'other window destination'
  );
  const otherFrame = await frameAt(`${alias}/identity-other-window`);
  const otherToken = await otherFrame.evaluate('window.token');
  await otherFrame.fill('#entry', 'Keep other website');
  const history = (await state()).history;
  const recents = (await state()).recentUrls;
  await panel.click('#more');
  await panel.click('#request-mobile');
  await poll(
    () =>
      inner.evaluate(
        'window.token !== ' + JSON.stringify(original) + ' && navigator.userAgentData.mobile'
      ),
    'mobile identity reload'
  );
  assert.equal((await state()).requestMobile, true);
  assert.equal(await otherFrame.evaluate('window.token'), otherToken);
  assert.equal(
    await otherFrame.evaluate("document.querySelector('#entry').value"),
    'Keep other website'
  );
  assert.equal(await otherFrame.evaluate('navigator.userAgent'), native.userAgent);

  assert(
    await inner.evaluate(
      "window.initialIdentity.mobile && window.requestIdentity['user-agent'].includes('Android')"
    )
  );
  assert.deepEqual((await state()).history, history);
  assert.deepEqual((await state()).recentUrls, recents);
  await secondPanel.fill('#address', `${base}/identity-same-site-window`);
  await secondPanel.press('Enter');
  await poll(
    async () => (await state(secondPanel)).url === `${base}/identity-same-site-window`,
    'same site in other window'
  );
  const sameSiteFrame = await frameAt(`${base}/identity-same-site-window`);
  assert(await sameSiteFrame.evaluate('window.initialIdentity.mobile'));

  assert(
    await inner.evaluate(
      `!Object.hasOwn(screen, 'width') && !Object.hasOwn(visualViewport, 'scale')`
    )
  );
  await normal.reload();
  assert.equal(await normal.evaluate(() => navigator.userAgent), native.userAgent);
  assert.equal(await normal.evaluate(() => window.requestIdentity['user-agent']), native.userAgent);

  await inner.evaluate(
    `for (const url of ${JSON.stringify([`${base}/identity-nested`, `${alias}/identity-third-party`])}) { const frame = document.createElement('iframe'); frame.src = url; document.body.append(frame); }`
  );
  // Same-origin descendants share their ancestor's target. Read via the parent.
  await poll(
    () =>
      inner.evaluate(
        `document.querySelector('iframe')?.contentWindow?.initialIdentity?.mobile === true`
      ),
    'same-host nested identity'
  );
  assert(
    await inner.evaluate(
      `document.querySelector('iframe').contentWindow.requestIdentity['user-agent'].includes('Android')`
    )
  );
  const thirdParty = await frameAt(`${alias}/identity-third-party`);
  assert.equal(await thirdParty.evaluate('navigator.userAgent'), native.userAgent);
  assert.equal(await thirdParty.evaluate('window.requestIdentity["user-agent"]'), native.userAgent);
  assert.equal(
    await inner.evaluate(
      `fetch(${JSON.stringify(`${alias}/identity-headers`)}).then(r => r.json()).then(h => h['user-agent'])`
    ),
    native.userAgent
  );
  assert(
    await inner.evaluate(
      "fetch('/identity-headers').then(r => r.json()).then(h => h['user-agent'].includes('Android'))"
    )
  );

  await options.locator('[data-hostname="127.0.0.1"]').waitFor();
  await options.locator('#sites-heading').scrollIntoViewIfNeeded();
  await options.screenshot({ path: join(output, 'site-preferences-settings.png') });
  await options.setViewportSize({ width: 320, height: 740 });
  assert(await options.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await options.locator('#sites-heading').scrollIntoViewIfNeeded();
  await options.screenshot({ path: join(output, 'site-preferences-settings-320.png') });
  const token = await inner.evaluate('window.token');
  await options.locator('#mode').selectOption('desktop');
  await poll(async () => (await state()).defaultMode === 'desktop', 'default changed');
  assert.equal((await state()).mode, 'mobile');
  assert.equal(await inner.evaluate('window.token'), token);
  await options.locator('[data-hostname="127.0.0.1"]').click();
  await poll(
    () => inner.evaluate('navigator.userAgentData.mobile === false'),
    'settings reset restores native identity'
  );
  assert.equal((await state()).mode, 'desktop');
  await poll(
    () => sameSiteFrame.evaluate('navigator.userAgentData.mobile === false'),
    'same-site reset synchronized across windows'
  );
  await panel.evaluate(`chrome.windows.remove(${secondWindow.id})`);
  await options.locator('#mode').selectOption('mobile');
  await poll(async () => (await state()).mode === 'mobile', 'default narrow restored');

  await panel.click('#more');
  await panel.click('#request-mobile');
  await poll(() => inner.evaluate('navigator.userAgentData.mobile === true'), 'mobile reenabled');
  await panel.click('#more');
  assert.equal(
    await panel.evaluate('document.querySelector("#request-mobile").getAttribute("aria-pressed")'),
    'true'
  );
  await screenshot('site-preferences-native');
  await panel.press('Escape');
  await navigate(`${base}/cross-site-redirect`, `${alias}/identity-redirected`);
  inner = await frameAt(`${alias}/identity-redirected`);
  assert.equal((await state()).requestMobile, false);
  assert.equal(await inner.evaluate('window.requestIdentity["user-agent"]'), native.userAgent);
  // Returning to the saved hostname applies its identity to the very first request.
  await navigate(`${base}/identity-return`);
  inner = await frameAt(`${base}/identity-return`);
  assert(await inner.evaluate('window.initialIdentity.mobile && navigator.userAgentData.mobile'));
  await panel.click('#more');
  await panel.click('#mode');
  await poll(
    () => inner.evaluate('navigator.userAgentData.mobile === false'),
    'full width disables mobile identity'
  );
  assert.equal((await state()).requestMobile, false);
  await panel.click('#more');
  await panel.click('#reset-site');
  await poll(
    async () => !('127.0.0.1' in (await state()).sitePreferences),
    'panel reset removed site preference'
  );
  // Retain another hostname's explicit opt-in for the full browser-restart check.
  await navigate(`${alias}/identity-persist`);
  inner = await frameAt(`${alias}/identity-persist`);
  await panel.click('#more');
  await panel.click('#request-mobile');
  await poll(() => inner.evaluate('navigator.userAgentData.mobile === true'), 'second site opt-in');
  await navigate(`${base}/identity-final`);
  inner = await frameAt(`${base}/identity-final`);
  assert.equal(await inner.evaluate('navigator.userAgent'), native.userAgent);
  assert.equal((await state()).requestMobile, false);
  await options.close();
  await normal.close();
}
