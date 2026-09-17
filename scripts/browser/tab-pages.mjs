import assert from 'node:assert/strict';
import { poll } from './cdp.mjs';

export async function checkTabPages({
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
}) {
  assert.equal((await state()).tabId, null);
  const newTab = path =>
    panel.evaluate(
      `chrome.tabs.create({ url: ${JSON.stringify(base)} + ${JSON.stringify(path)}, active: true })`
    );
  const switchTab = async tab => {
    await panel.evaluate(`chrome.tabs.update(${tab.id}, { active: true })`);
    await poll(
      () => panel.evaluate(`document.body.dataset.sourceTabId === '${tab.id}'`),
      'source tab selected'
    );
  };
  const bind = async (tab, bound) => {
    await switchTab(tab);
    assert.equal(
      await panel.evaluate("document.querySelector('#binding-label').textContent"),
      bound ? catalog.bindTab.message : catalog.unbindTab.message
    );
    await panel.click('#more');
    await panel.click('#binding');
    await poll(
      () =>
        panel.evaluate(
          `document.body.dataset.tabId === '${bound ? tab.id : 'shared'}' && !document.querySelector('#binding').disabled`
        ),
      'binding changed'
    );
    assert.equal((await state()).tabId, bound ? tab.id : null);
  };
  const assertSharedEmpty = async () => {
    await poll(
      async () => (await state()).url === '' && (await state()).tabId === null,
      'shared slot emptied'
    );
    assert.deepEqual((await state()).history, []);
    assert.equal((await state()).historyIndex, -1);
    assert(
      await panel.evaluate(`!document.querySelector('#empty').hidden &&
      document.querySelector('#address').value === '' &&
      document.querySelector('#web').contentWindow.location.href === 'about:blank' &&
      document.querySelector('#back').disabled && document.querySelector('#forward').disabled`)
    );
  };
  const wiki = await newTab('/wiki-main');
  await switchTab(wiki);
  await navigate(`${base}/google`);
  const google = await frameAt(`${base}/google`);
  const googleToken = await google.evaluate('window.token');
  await google.fill('#entry', 'Wiki research query');
  await google.evaluate("document.body.style.minHeight = '2200px'; window.scrollTo(0, 300)");
  await poll(() => google.evaluate('scrollY === 300'), 'Google scroll position');
  await bind(wiki, true);
  assert.equal(await google.evaluate('window.token'), googleToken);
  assert.equal(
    await google.evaluate("document.querySelector('#entry').value"),
    'Wiki research query'
  );

  // Binding consumes the shared page; unbound tabs must now start empty.
  const hn = await newTab('/hacker-news-main');
  await switchTab(hn);
  await assertSharedEmpty();
  await screenshot('shared-empty-after-binding');
  assert.equal(await google.evaluate('window.token'), googleToken);
  await switchTab(wiki);
  assert.equal(await google.evaluate('scrollY'), 300);
  await switchTab(hn);
  await assertSharedEmpty();
  assert.equal(
    await panel.evaluate(`document.querySelectorAll('.page-web[src="${base}/google"]').length`),
    1
  );
  await navigate(`${base}/baidu`);
  await navigate(`${base}/baidu-results`);
  await panel.click('#back');
  const baidu = await loaded(`${base}/baidu`);
  const baiduToken = await baidu.evaluate('window.token');
  await baidu.fill('#entry', 'Hacker News query');
  await bind(hn, true);
  assert.equal(await baidu.evaluate('window.token'), baiduToken);
  assert.deepEqual((await state()).history.slice(-2), [`${base}/baidu`, `${base}/baidu-results`]);

  // Multiple unbound tabs must share the same live document while both bindings stay alive.
  const unboundA = await newTab('/unbound-a');
  await switchTab(unboundA);
  await assertSharedEmpty();
  await navigate(`${base}/shared-page`);
  const shared = await frameAt(`${base}/shared-page`);
  const sharedToken = await shared.evaluate('window.token');
  await shared.fill('#entry', 'Shared between unbound tabs');
  const unboundB = await newTab('/unbound-b');
  await switchTab(unboundB);
  assert.equal((await state()).tabId, null);
  assert.equal((await state()).url, `${base}/shared-page`);
  assert.equal(await shared.evaluate('window.token'), sharedToken);
  assert.equal(
    await shared.evaluate("document.querySelector('#entry').value"),
    'Shared between unbound tabs'
  );
  await panel.click('#more');
  await screenshot('unbound-shared-menu');
  await panel.press('Escape');
  const bindings = await panel.evaluate(
    "chrome.storage.session.get('pocket-sidepanel-bindings-v1')"
  );
  assert.deepEqual(
    Object.keys(bindings['pocket-sidepanel-bindings-v1']).sort(),
    [String(wiki.id), String(hn.id)].sort()
  );
  for (let i = 0; i < 3; i++) {
    await switchTab(wiki);
    assert.equal((await state()).url, `${base}/google`);
    assert.deepEqual((await state()).history, [`${base}/google`]);
    assert.equal(await google.evaluate('window.token'), googleToken);
    assert.equal(await google.evaluate('scrollY'), 300);
    await switchTab(hn);
    assert.equal((await state()).url, `${base}/baidu`);
    assert.equal(await baidu.evaluate('window.token'), baiduToken);
    assert.equal(
      await baidu.evaluate("document.querySelector('#entry').value"),
      'Hacker News query'
    );
    assert.equal(await panel.evaluate("document.querySelector('#forward').disabled"), false);
    await switchTab(unboundA);
    await switchTab(unboundB);
    assert.equal(await shared.evaluate('window.token'), sharedToken);
  }
  await panel.evaluate(`(async () => {
    for (let i = 0; i < 6; i++) {
      for (const id of [${wiki.id}, ${unboundA.id}, ${hn.id}, ${unboundB.id}]) await chrome.tabs.update(id, { active: true });
    }
  })()`);
  await switchTab(hn);
  assert.equal(await google.evaluate('window.token'), googleToken);
  assert.equal(await baidu.evaluate('window.token'), baiduToken);
  assert.equal(await shared.evaluate('window.token'), sharedToken);
  await panel.click('#more');
  await screenshot('bound-tab-menu');
  await panel.press('Escape');

  await google.evaluate(
    `history.pushState({}, '', ${JSON.stringify(`${base}/google-background`)}); document.title = 'Hidden Google title'`
  );
  await poll(async () => {
    const saved = await panel.evaluate(
      "chrome.storage.session.get('pocket-sidepanel-bindings-v1')"
    );
    return (
      saved['pocket-sidepanel-bindings-v1'][wiki.id]?.state.url === `${base}/google-background`
    );
  }, 'hidden bound navigation persisted');
  assert.equal((await state()).url, `${base}/baidu`);
  await switchTab(unboundA);
  assert.equal((await state()).url, `${base}/shared-page`);

  // Stop a real worker lifetime while bound and shared documents remain mounted.
  const source = context.pages().find(page => page.url() === `${base}/hacker-news-main`);
  assert(source);
  const session = await context.newCDPSession(source);
  const worker = (await targets()).find(target => target.url === `${extension}/background.js`);
  if (attached.has(worker.targetId)) {
    await attached.get(worker.targetId).detach();
    attached.delete(worker.targetId);
  }
  let stopped = false;
  let restarted = false;
  session.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
    for (const version of versions) {
      if (version.scriptURL !== `${extension}/background.js`) continue;
      if (version.runningStatus === 'stopped') stopped = true;
      if (stopped && version.runningStatus === 'running') restarted = true;
    }
  });
  await session.send('ServiceWorker.enable');
  await session.send('ServiceWorker.stopAllWorkers');
  await poll(() => restarted, 'binding worker reconnect');
  await session.detach();
  const recovered = (await targets()).find(target => target.url === `${extension}/background.js`);
  await attach(recovered.targetId);
  await switchTab(wiki);
  assert.equal((await state()).url, `${base}/google-background`);
  assert.equal(await google.evaluate('window.token'), googleToken);
  assert.equal(await google.evaluate('scrollY'), 300);
  await switchTab(hn);
  assert.equal(await baidu.evaluate('window.token'), baiduToken);
  await source.goto(`${base}/hacker-news-article`);
  assert.equal((await state()).tabId, hn.id);
  assert.equal(await baidu.evaluate('window.token'), baiduToken);

  // Unbinding only this pair returns to the existing shared instance.
  await bind(hn, false);
  assert.equal((await state()).url, `${base}/shared-page`);
  assert.equal(await shared.evaluate('window.token'), sharedToken);
  assert.equal(
    await shared.evaluate("document.querySelector('#entry').value"),
    'Shared between unbound tabs'
  );
  assert.equal(await panel.evaluate("document.querySelectorAll('.page-web').length"), 2);
  await switchTab(wiki);
  assert.equal((await state()).tabId, wiki.id);
  assert.equal(await google.evaluate('window.token'), googleToken);
  await switchTab(hn);
  assert.equal((await state()).tabId, null);
  await switchTab(unboundB);
  assert.equal(await shared.evaluate('window.token'), sharedToken);

  // Closing a bound side page keeps the binding and does not close the shared page.
  await switchTab(wiki);
  await panel.click('#more');
  await panel.click('#close-page');
  await poll(async () => (await state()).url === '', 'bound side page closed');
  assert.equal((await state()).tabId, wiki.id);
  await switchTab(unboundA);
  assert.equal(await shared.evaluate('window.token'), sharedToken);
  await switchTab(wiki);
  await panel.click('#recent');
  await panel.click(`.recent-open[data-url="${base}/google"]`);
  await loaded(`${base}/google`);
  for (const width of [320, 480]) {
    await panel.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 680,
      deviceScaleFactor: 1,
      mobile: false
    });
    await panel.click('#more');
    assert(
      await panel.evaluate(`document.documentElement.scrollWidth === innerWidth &&
      document.querySelector('#binding').getBoundingClientRect().right <= innerWidth &&
      document.querySelectorAll('.page-viewport:not([hidden])').length === 1`)
    );
    await screenshot(`binding-menu-simulated-${width}`);
    await panel.press('Escape');
  }
  await panel.send('Emulation.clearDeviceMetricsOverride');
  await panel.send('Page.reload');
  await loaded(`${base}/google`);
  assert.equal((await state()).tabId, wiki.id);
  await switchTab(unboundA);
  await loaded(`${base}/shared-page`);
  const restoredShared = await frameAt(`${base}/shared-page`);
  const restoredToken = await restoredShared.evaluate('window.token');
  await panel.evaluate(`chrome.tabs.remove(${wiki.id})`);
  await poll(
    () => panel.evaluate("document.querySelectorAll('.page-web').length === 1"),
    'closed bound tab released'
  );
  assert.equal(await restoredShared.evaluate('window.token'), restoredToken);
  const remaining = await panel.evaluate(
    "chrome.storage.session.get('pocket-sidepanel-bindings-v1')"
  );
  assert.deepEqual(remaining['pocket-sidepanel-bindings-v1'], {});

  // Consuming the last shared page must remain empty after panel and browser restart.
  await switchTab(unboundA);
  await bind(unboundA, true);
  assert.equal(await restoredShared.evaluate('window.token'), restoredToken);
  await switchTab(unboundB);
  await assertSharedEmpty();
  await panel.send('Page.reload');
  await assertSharedEmpty();
  await screenshot('shared-empty-restored');
  const options = await context.newPage();
  await options.goto(`${extension}/options.html`);
  await poll(() => options.locator('#mode').isEnabled(), 'settings ready');
  assert.equal(await options.locator('#scope').count(), 0);
  await options.close();
  console.log(
    'PASS Binding transfers the live page and clears shared URL/history/restoration;  two bound tabs and multiple shared tabs coexist; unbinding, history, hidden navigation, worker recovery, source closure and narrow layouts pass'
  );
}
