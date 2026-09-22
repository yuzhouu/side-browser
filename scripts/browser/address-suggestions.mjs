import assert from 'node:assert/strict';
import { poll } from './cdp.mjs';

export async function checkAddressSuggestions({
  panel,
  state,
  navigate,
  loaded,
  frameAt,
  screenshot,
  base,
  catalog
}) {
  const recent = `${base}/qa-suggest-recent`;
  const bookmark = `${base}/qa-suggest-bookmark`;
  const history = `${base}/qa-suggest-history`;
  const request = (type, data = {}) =>
    panel.evaluate(
      `chrome.windows.getCurrent().then(window => chrome.runtime.sendMessage({type: ${JSON.stringify(type)}, windowId: window.id, ...${JSON.stringify(data)}}))`
    );
  const open = () =>
    panel.evaluate("document.querySelector('#address-suggestions').matches(':popover-open')");
  const rows = () =>
    panel.evaluate(
      "[...document.querySelectorAll('.address-option[data-kind=url]')].map(el => ({ url: el.querySelector('.recent-url').textContent, source: el.querySelector('.suggestion-source').textContent }))"
    );
  await navigate(recent);
  // Use the user-visible action so the normal favorite navigation contract is tested.
  if (!(await state()).favorites.some(item => item.url === recent)) {
    await panel.click('#more');
    await panel.click('#favorite');
  }
  const bookmarkIds = await panel.evaluate(`Promise.all([
    chrome.bookmarks.create({title: 'QA suggestion bookmark', url: ${JSON.stringify(bookmark)}}),
    chrome.bookmarks.create({title: 'QA suggestion duplicate', url: ${JSON.stringify(recent)}})
  ]).then(items => items.map(item => item.id))`);
  await panel.evaluate(`chrome.history.addUrl({url: ${JSON.stringify(history)}})`);
  await panel.fill('#address', 'qa-suggest');
  await poll(
    async () =>
      (await rows()).some(item => item.url === history) &&
      (await rows()).some(item => item.url === bookmark),
    'browser history and bookmark suggestions'
  );
  const matches = await rows();
  assert.equal(matches.filter(item => item.url === recent).length, 1);
  const combined = matches.find(item => item.url === recent).source;
  for (const key of ['suggestionRecent', 'suggestionFavorite', 'suggestionBookmark'])
    assert(combined.includes(catalog[key].message));
  assert(
    matches.find(item => item.url === history).source.includes(catalog.suggestionHistory.message)
  );
  assert(await open());
  assert(
    await panel.evaluate(
      "document.activeElement.id === 'address' && document.querySelector('#address').getAttribute('aria-expanded') === 'true'"
    )
  );
  await screenshot('suggestions-native');
  for (const theme of ['light', 'dark']) {
    await request('PANEL_THEME', { theme });
    for (const width of [320, 480]) {
      await panel.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 520,
        deviceScaleFactor: 1,
        mobile: false
      });
      await panel.fill('#address', 'qa-suggest');
      await poll(
        async () => (await rows()).some(item => item.url === bookmark),
        'suggestions after viewport change'
      );
      assert(
        await panel.evaluate(`(() => {
        const list = document.querySelector('#address-suggestions');
        const box = list.getBoundingClientRect();
        return box.top >= 35 && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && list.scrollWidth === list.clientWidth;
      })()`)
      );
      await screenshot(`suggestions-${theme}-${width}`);
    }
  }
  await panel.send('Emulation.clearDeviceMetricsOverride');
  await panel.press('ArrowDown');
  await panel.press('ArrowDown');
  const selected = await panel.evaluate(
    "document.querySelector('[role=option][aria-selected=true] .recent-url').textContent"
  );
  assert(
    await panel.evaluate(
      "document.querySelector('#address').getAttribute('aria-activedescendant') === document.querySelector('[role=option][aria-selected=true]').id"
    )
  );
  await panel.press('Enter');
  await loaded(selected);
  assert.equal((await state()).recentUrls[0], selected);
  assert(!(await open()));
  await panel.fill('#address', 'qa-suggest-bookmark');
  await poll(
    async () => (await rows()).some(item => item.url === bookmark),
    'bookmark click suggestion'
  );
  await panel.click('.address-option[data-kind=url]');
  await loaded(bookmark);
  assert.equal((await state()).recentUrls[0], bookmark);
  assert(!(await open()));

  // A late provider result must never overwrite a newer query or reopen a dismissed menu.
  await panel.evaluate(`window.qaHistorySearch = chrome.history.search;
    chrome.history.search = query => new Promise(resolve => setTimeout(() => resolve([{url: ${JSON.stringify(history)}, title: 'QA suggestion history'}]), 350));`);
  await panel.fill('#address', 'qa-suggest');
  await panel.evaluate('new Promise(resolve => setTimeout(resolve, 160))');
  await panel.fill('#address', 'no-matches-7a6e1');
  await panel.evaluate('new Promise(resolve => setTimeout(resolve, 550))');
  assert(await open());
  assert.deepEqual(await rows(), []);
  assert.equal(
    await panel.evaluate("document.querySelectorAll('.address-option[data-kind=search]').length"),
    1
  );
  await panel.fill('#address', 'qa-suggest');
  await panel.press('Escape');
  await panel.evaluate('new Promise(resolve => setTimeout(resolve, 550))');
  assert(!(await open()));
  assert.equal(await panel.evaluate("document.querySelector('#address').value"), 'qa-suggest');
  await panel.evaluate(
    'chrome.history.search = window.qaHistorySearch; delete window.qaHistorySearch'
  );

  await panel.fill('#address', 'qa-suggest');
  await poll(open, 'composition preparation');
  const before = (await state()).url;
  await panel.evaluate(`(() => {
    const input = document.querySelector('#address');
    input.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
    input.value = '中文';
    input.dispatchEvent(new InputEvent('input', {bubbles: true, isComposing: true}));
    document.querySelector('#navigate').requestSubmit();
  })()`);
  assert(!(await open()));
  assert.equal((await state()).url, before);
  await panel.evaluate(`(() => {
    const input = document.querySelector('#address');
    input.value = 'qa-suggest';
    input.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true}));
  })()`);
  await poll(open, 'composition completion');
  const frame = await frameAt(before);
  await frame.click('#entry');
  await poll(async () => !(await open()), 'iframe click dismisses suggestions');
  await panel.fill('#address', 'qa-suggest');
  await poll(open, 'menu exclusion preparation');
  await panel.click('#recent');
  assert(!(await open()));
  assert(await panel.evaluate("document.querySelector('#recent-menu').matches(':popover-open')"));
  await panel.press('Escape');
  await panel.fill('#address', '');
  await poll(open, 'empty input local suggestions');
  assert(
    (await rows()).every(
      item =>
        !item.source.includes(catalog.suggestionBookmark.message) &&
        !item.source.includes(catalog.suggestionHistory.message)
    )
  );
  await panel.press('Escape');
  for (const id of bookmarkIds)
    await panel.evaluate(`chrome.bookmarks.remove(${JSON.stringify(id)})`);
  console.log(
    'PASS Address suggestions: four sources, deduplication, keyboard/mouse navigation, IME, stale query cancellation, dismissal, native and 320px/480px themed layouts'
  );
}
