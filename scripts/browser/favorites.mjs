import assert from 'node:assert/strict';
import { poll } from './cdp.mjs';

export async function checkFavorites({
  context,
  panel,
  state,
  navigate,
  loaded,
  frameAt,
  screenshot,
  openPanel,
  base,
  catalog
}) {
  const entries = api =>
    api.evaluate(
      "[...document.querySelectorAll('.favorite-open')].map(button => button.dataset.url)"
    );
  const request = (type, data = {}, api = panel) =>
    api.evaluate(`chrome.windows.getCurrent().then(window =>
    chrome.runtime.sendMessage({ type: ${JSON.stringify(type)}, windowId: window.id, ...${JSON.stringify(data)} }))`);
  const favorite = async () => {
    await panel.click('#favorite-current');
  };
  const close = async () => {
    await panel.click('#more');
    await panel.click('#close-page');
    await poll(
      () => panel.evaluate("!document.querySelector('#empty').hidden"),
      'favorite welcome page'
    );
  };
  assert(
    await panel.evaluate(
      "document.querySelector('#favorite-current').disabled && document.querySelector('#favorites').hidden"
    )
  );
  const first = `${base}/favorite-first`;
  const second = `${base}/favorite-second?source=favorites&topic=${'reference-material-'.repeat(12)}`;
  await navigate(first);
  const frame = await frameAt(first);
  const token = await frame.evaluate('window.token');
  await frame.evaluate("document.title = '常用资料 · Quick reference'");
  await poll(
    async () => (await state()).recentTitles[first] === '常用资料 · Quick reference',
    'favorite source title'
  );
  await favorite();
  await poll(
    async () => (await state()).favorites[0]?.title === '常用资料 · Quick reference',
    'favorite added'
  );
  assert.equal(await frame.evaluate('window.token'), token);
  assert(
    await panel.evaluate(
      "document.querySelector('#favorite-current').getAttribute('aria-pressed') === 'true'"
    )
  );
  assert.equal(
    await panel.evaluate("document.querySelector('#favorite-current').getAttribute('aria-label')"),
    catalog.removeFavorite.message
  );
  await screenshot('favorite-saved-toolbar');
  await request('PANEL_CLEAR_RECENT');
  await frame.evaluate("document.title = '常用资料 · Updated reference'");
  await poll(
    async () => (await state()).favorites[0]?.title === '常用资料 · Updated reference',
    'favorite title independent of recents'
  );
  await favorite();
  await poll(async () => !(await state()).favorites.length, 'favorite toolbar button removes');
  await favorite();
  await poll(async () => (await state()).favorites.length === 1, 'favorite can be added again');
  // Internal navigation must save its own title, even without a recent entry.
  await frame.evaluate(`location.href = ${JSON.stringify(second)}`);
  const secondFrame = await loaded(second);
  const longTitle = '资料与灵感 · Research and inspiration — '.repeat(10).trim();
  await secondFrame.evaluate(`document.title = ${JSON.stringify(longTitle)}`);
  await poll(
    () => secondFrame.evaluate(`document.title === ${JSON.stringify(longTitle)}`),
    'internal page title'
  );
  await favorite();
  await poll(
    async () => (await state()).favorites[0]?.title === longTitle,
    'internal navigation favorite metadata'
  );
  // The clock menu exposes favorites without leaving or reloading the live page.
  const browsingToken = await secondFrame.evaluate('window.token');
  await panel.click('#recent');
  await panel.click('#favorites-tab');
  assert(
    await panel.evaluate(
      "!document.querySelector('#saved-panel').hidden && document.querySelector('#clear-recent').hidden"
    )
  );
  const editorOpened = context.waitForEvent('page');
  await panel.click('#edit-favorites');
  const favoriteOptions = await editorOpened;
  await favoriteOptions.waitForURL(/\/options\.html#favorites$/);
  await poll(
    () =>
      favoriteOptions
        .locator('.managed-item')
        .count()
        .then(count => count === 2),
    'favorite settings loaded'
  );
  assert(await favoriteOptions.evaluate(() => document.activeElement.id === 'favorites-heading'));
  assert.equal(
    await panel.evaluate("document.querySelectorAll('.saved-editor, .saved-actions').length"),
    0
  );
  await favoriteOptions.locator('.managed-item:last-child [data-action="edit"]').click();
  assert(await favoriteOptions.locator('.managed-item:last-child > .managed-actions').isHidden());
  assert(await favoriteOptions.locator('.managed-item:last-child > .managed-info').isHidden());
  assert.equal(await favoriteOptions.locator('.managed-edit-actions button').count(), 2);
  await favoriteOptions.locator('.managed-editor [name="title"]').fill('Discard this name');
  await favoriteOptions.locator('.managed-editor [name="url"]').fill(`${base}/discard-url`);
  await favoriteOptions.locator('.managed-editor [name="title"]').press('Escape');
  assert.equal(await favoriteOptions.locator('.managed-editor').count(), 0);
  assert.equal((await state()).favorites[1].customTitle, undefined);
  assert.equal((await state()).favorites[1].url, first);
  assert(await favoriteOptions.locator('.managed-item:last-child > .managed-actions').isVisible());
  await favoriteOptions.locator('.managed-item:last-child [data-action="edit"]').click();
  await favoriteOptions.locator('.managed-editor [name="title"]').fill('Daily reference');
  await favoriteOptions.locator('.managed-editor [name="title"]').press('Enter');
  await poll(
    async () => (await state()).favorites[1].customTitle === 'Daily reference',
    'favorite renamed from settings'
  );
  await poll(
    () =>
      favoriteOptions
        .locator('.managed-editor')
        .count()
        .then(count => count === 0),
    'rename saved'
  );
  const updatedUrl = `${base}/favorite-updated-url`;
  await favoriteOptions.locator('.managed-item:last-child [data-action="edit"]').click();
  await favoriteOptions.locator('.managed-editor [name="url"]').fill(second);
  await favoriteOptions.locator('.managed-editor [type="submit"]').click();
  await poll(
    () => favoriteOptions.locator('#managed-feedback').isVisible(),
    'duplicate address rejected'
  );
  assert.equal((await state()).favorites[1].url, first);
  assert.equal(await favoriteOptions.locator('.managed-editor').count(), 1);
  await favoriteOptions.locator('.managed-editor [name="url"]').fill(updatedUrl);
  await favoriteOptions.locator('.managed-editor [name="url"]').press('Enter');
  await poll(
    async () => (await state()).favorites[1].url === updatedUrl,
    'favorite address updated'
  );
  await poll(
    () =>
      favoriteOptions
        .locator('.managed-editor')
        .count()
        .then(count => count === 0),
    'URL edit saved'
  );
  assert.deepEqual(await entries(panel), [second, updatedUrl]);
  assert.equal((await state()).url, second);
  await favoriteOptions.locator('.managed-item:last-child [data-action="edit"]').click();
  await favoriteOptions.locator('.managed-editor [name="url"]').fill(first);
  await favoriteOptions.locator('.managed-editor [type="submit"]').click();
  await poll(async () => (await state()).favorites[1].url === first, 'favorite address restored');
  await poll(
    () =>
      favoriteOptions
        .locator('.managed-editor')
        .count()
        .then(count => count === 0),
    'restored edit finished'
  );
  await favoriteOptions.locator('.managed-item:last-child [data-action="up"]').click();
  await poll(async () => (await state()).favorites[0].url === first, 'favorite moved up');
  assert.deepEqual(await entries(panel), [first, second]);
  await poll(
    () =>
      favoriteOptions
        .locator('.managed-item:first-child [data-action="down"]')
        .getAttribute('aria-disabled')
        .then(value => value === 'false'),
    'favorite controls ready'
  );
  await favoriteOptions.locator('.managed-item:first-child [data-action="down"]').click();
  await poll(async () => (await state()).favorites[0].url === second, 'favorite moved down');
  assert.equal(await secondFrame.evaluate('window.token'), browsingToken);
  for (const width of [960, 320]) {
    await favoriteOptions.setViewportSize({ width, height: 720 });
    assert(
      await favoriteOptions.evaluate(() => document.documentElement.scrollWidth === innerWidth)
    );
  }
  await favoriteOptions.close();
  await panel.click('#recent');
  await panel.click('.saved-item:last-child .saved-open');
  await loaded(first);
  assert(await panel.evaluate("!document.querySelector('#recent-menu').matches(':popover-open')"));
  assert.equal(
    (await state()).favorites.find(item => item.url === first).customTitle,
    'Daily reference'
  );
  // Restore the Recent tab for existing recent-menu regression scenarios.
  await panel.click('#recent');
  await panel.click('#recent-tab');
  await panel.press('Escape');
  await close();
  assert.deepEqual(await entries(panel), [second, first]);
  const homeEditorOpened = context.waitForEvent('page');
  await panel.click('#edit-home-favorites');
  const homeOptions = await homeEditorOpened;
  await homeOptions.waitForURL(/\/options\.html#favorites$/);
  await poll(
    () =>
      homeOptions
        .locator('.managed-item')
        .count()
        .then(count => count === 2),
    'home edit opens favorite settings'
  );
  assert.equal((await state()).url, '');
  await homeOptions.close();
  assert.equal(
    await panel.evaluate("document.querySelector('#favorites-heading').textContent"),
    catalog.favorites.message
  );
  await panel.send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 760,
    deviceScaleFactor: 1,
    mobile: false
  });
  await panel.evaluate(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  );
  const hoverPosition = await panel.evaluate(`(() => {
    const box = document.querySelector('.favorite-open').getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  })()`);
  await panel.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hoverPosition });
  await panel.evaluate(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  );
  await poll(
    () => panel.evaluate("document.querySelector('#favorite-tooltip').matches(':popover-open')"),
    'favorite hover tooltip'
  );
  assert.equal(
    await panel.evaluate("document.querySelector('.favorite-tooltip-title').textContent"),
    longTitle
  );
  assert.equal(
    await panel.evaluate("document.querySelector('.favorite-tooltip-url').textContent"),
    second
  );
  assert(
    await panel.evaluate(`(() => {
    const tooltip = document.querySelector('#favorite-tooltip');
    const box = tooltip.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth &&
      tooltip.scrollWidth === tooltip.clientWidth &&
      document.querySelector('.favorite-open').textContent.trim() === '';
  })()`)
  );
  await screenshot('favorites-hover-320');
  await panel.press('Escape');
  assert(
    await panel.evaluate("!document.querySelector('#favorite-tooltip').matches(':popover-open')")
  );
  await panel.send('Emulation.clearDeviceMetricsOverride');

  // Changes in another native panel update the welcome page without replacing navigation.
  const otherWindow = await panel.evaluate(
    `chrome.windows.create({ url: ${JSON.stringify(`${base}/favorite-window`)}, type: 'normal' })`
  );
  const other = await openPanel(otherWindow.id);
  await poll(
    async () => (await entries(other)).length === 2,
    'favorites shared with another window'
  );
  await other.evaluate("document.querySelector('.favorite-remove').focus()");
  await other.click('.favorite-item:first-child .favorite-remove');
  await poll(async () => (await entries(panel)).length === 1, 'favorite removal broadcast');
  assert.equal((await state()).url, '');
  await panel.click('.favorite-open');
  await loaded(first);
  await poll(
    async () => (await state()).recentUrls[0] === first,
    'favorite open records explicit navigation'
  );
  await request('PANEL_REMOVE_FAVORITE', { url: first }, other);
  await poll(
    () =>
      panel.evaluate(
        "document.querySelector('#favorite-current').getAttribute('aria-pressed') === 'false'"
      ),
    'remote removal updates toolbar'
  );
  assert.equal((await state()).url, first);
  await favorite();
  await poll(async () => (await entries(other)).length === 1, 'favorite add broadcast');
  await navigate(second);
  const visualFrame = await frameAt(second);
  await visualFrame.evaluate("document.title = '灵感收集 · Inspiration'");
  await favorite();
  await poll(
    async () => (await state()).favorites[0]?.title === '灵感收集 · Inspiration',
    'second favorite restored'
  );
  await close();
  await panel.evaluate(`chrome.windows.remove(${otherWindow.id})`);

  const extraUrls = Array.from({ length: 12 }, (_, index) => `${base}/shortcut-${index}`);
  for (const url of extraUrls) {
    await navigate(url);
    await favorite();
  }
  await close();
  assert.equal((await entries(panel)).length, 14);

  for (const theme of ['light', 'dark']) {
    await request('PANEL_THEME', { theme });
    await poll(
      () => panel.evaluate(`document.documentElement.dataset.theme === '${theme}'`),
      'favorites theme'
    );
    await panel.evaluate("document.querySelector('#empty').scrollTop = 0");
    await screenshot(`favorites-native-${theme}`);
    for (const width of [320, 480]) {
      await panel.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 760,
        deviceScaleFactor: 1,
        mobile: false
      });
      assert(
        await panel.evaluate(`(() => {
        const empty = document.querySelector('#empty');
        const tiles = [...document.querySelectorAll('.favorite-item')].map(item => item.getBoundingClientRect());
        return tiles.length === 14 && tiles[1].top === tiles[0].top && tiles[1].left > tiles[0].left && tiles.at(-1).top > tiles[0].top && empty.scrollWidth === empty.clientWidth &&
          [...document.querySelectorAll('.favorite-item, .favorite-open, .favorite-remove')].every(item => {
            const box = item.getBoundingClientRect();
            return box.left >= 0 && box.right <= innerWidth;
          });
      })()`)
      );
      await screenshot(`favorites-${theme}-${width}`);
    }
    await panel.send('Emulation.clearDeviceMetricsOverride');
  }
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
  await panel.click('.favorite-item:last-child .favorite-open');
  await loaded(first);
  await close();
  await panel.send('Emulation.clearDeviceMetricsOverride');
  for (const url of extraUrls) await request('PANEL_REMOVE_FAVORITE', { url });
  await poll(async () => (await entries(panel)).length === 2, 'extra grid fixtures removed');
  await panel.evaluate("document.querySelector('.favorite-open').focus()");
  assert(
    await panel.evaluate("document.querySelector('#favorite-tooltip').matches(':popover-open')")
  );
  // Removing entries by keyboard keeps focus useful, including the final entry.
  await panel.evaluate("document.querySelector('.favorite-remove').focus()");
  await panel.press('Enter');
  await poll(async () => (await entries(panel)).length === 1, 'favorite removed by keyboard');
  assert(await panel.evaluate("document.activeElement.matches('.favorite-remove')"));
  await panel.press('Enter');
  await poll(async () => !(await entries(panel)).length, 'last favorite removed');
  assert(
    await panel.evaluate(
      "document.querySelector('#favorites').hidden && document.activeElement.id === 'empty-address'"
    )
  );
  // Leave one entry to verify panel refresh and full browser restart.
  await navigate(first);
  await favorite();
  await poll(async () => (await state()).favorites.length === 1, 'favorite persisted for restart');
  await close();
  const expected = (await state()).favorites;
  await panel.send('Page.reload');
  await poll(async () => (await entries(panel)).length === 1, 'favorites survive panel refresh');
  assert.deepEqual((await state()).favorites, expected);
  console.log(
    'PASS Favorites add/remove, exact-page titles, blank-page opening, cross-window sync, keyboard focus, native and narrow themed layouts'
  );
  return expected;
}
