import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_KEY, RECENT_TITLES_KEY } from '../src/recent-urls.ts';
import {
  LAST_KEY,
  MODE_KEY,
  BINDINGS_KEY,
  WINDOWS_KEY,
  navigatePanel,
  commitPanelNavigation
} from '../src/sidepanel-state.ts';
import { THEME_KEY } from '../src/theme-preference.ts';
import { SITE_PREFERENCES_KEY } from '../src/site-preferences.ts';
import { FAVORITES_KEY, restoreFavorites } from '../src/favorites.ts';
import { CUSTOM_SEARCH_ENGINE_KEY, SEARCH_ENGINE_KEY } from '../src/search-engine.ts';
import { RETURN_HOME_AFTER_OPEN_KEY } from '../src/open-tab-preference.ts';

const event = () => ({
  listeners: [],
  addListener(fn) {
    this.listeners.push(fn);
  },
  emit(...args) {
    for (const fn of this.listeners) fn(...args);
  }
});
const area = values => ({
  values: structuredClone(values),
  async get(keys) {
    return Object.fromEntries(
      (Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(this.values[key])])
    );
  },
  async set(values) {
    Object.assign(this.values, structuredClone(values));
  },
  async remove(key) {
    delete this.values[key];
  }
});
// Source-tab metadata may change while the underlying shared page stays identical.
const pageState = ({ sourceTabId, ...state }) => state;
const a = 'https://a.example/',
  b = 'https://b.example/',
  internal = 'https://a.example/internal';
let generation = 0;
async function background(context, localValues = {}, sessionValues = {}, configure = () => {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36' }
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else delete globalThis.chrome;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
  });
  const shell = 'chrome-extension://test/sidepanel.html';
  const sender = { id: 'test', url: shell, documentId: 'panel-document' };
  const chrome = (globalThis.chrome = {
    storage: {
      local: area({ [MODE_KEY]: 'desktop', ...localValues }),
      session: area(sessionValues)
    },
    runtime: {
      id: 'test',
      getURL: path => `chrome-extension://test/${path}`,
      getContexts: async () => [{}],
      onMessage: event(),
      onConnect: event(),
      onStartup: event(),
      onInstalled: event()
    },
    scripting: {
      registered: [],
      async getRegisteredContentScripts() {
        return structuredClone(this.registered);
      },
      async unregisterContentScripts() {
        this.registered = [];
      },
      async registerContentScripts(scripts) {
        this.registered = structuredClone(scripts);
      }
    },
    declarativeNetRequest: {
      rules: [],
      async getSessionRules() {
        return structuredClone(this.rules);
      },
      async updateSessionRules({ addRules }) {
        this.rules = structuredClone(addRules);
      }
    },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    windows: { get: async () => ({ type: 'normal' }), onRemoved: event() },
    tabs: {
      query: async ({ windowId } = {}) => [
        { id: windowId === 2 ? 20 : 10, windowId: windowId || 1, url: a }
      ],
      get: async id => ({ id, windowId: id >= 20 ? 2 : 1, url: a }),
      create: async () => {},
      update: async () => {},
      onActivated: event(),
      onRemoved: event(),
      onDetached: event(),
      onAttached: event()
    },
    contextMenus: {
      onClicked: event(),
      removeAll: async () => {},
      update: async () => {},
      create: (_options, callback) => callback()
    },
    i18n: { getMessage: key => key },
    commands: { onCommand: event() }
  });
  configure(chrome);
  await import(`../src/background.ts?recent-test=${++generation}`);
  const request = (type, data = {}, windowId = 1) =>
    new Promise((resolve, reject) => {
      chrome.runtime.onMessage.listeners[0]({ type, windowId, ...data }, sender, response => {
        if (response.ok) resolve(response.data);
        else reject(Object.assign(new Error(response.error), { code: response.errorCode }));
      });
    });
  await request('PANEL_READY');
  const settingsRequest = (
    type,
    data = {},
    from = { id: 'test', url: 'chrome-extension://test/options.html', tab: { id: 42 } }
  ) =>
    new Promise((resolve, reject) => {
      chrome.runtime.onMessage.listeners[0]({ type, ...data }, from, response => {
        if (response.ok) resolve(response.data);
        else reject(Object.assign(new Error(response.error), { code: response.errorCode }));
      });
    });
  return { chrome, request, sender, settingsRequest };
}

test('favorites restore valid unique URLs and titles without the recent-list capacity limit', () => {
  assert.deepEqual(restoreFavorites(null), []);
  assert.deepEqual(
    restoreFavorites([
      null,
      {},
      { url: 'javascript:alert(1)' },
      { url: 'chrome://settings' },
      { url: 'bad url' },
      { url: 'https://a.example', title: ' Home\n page ' },
      { url: a, title: 'Duplicate' },
      { url: internal, title: 42 }
    ]),
    [
      { url: a, title: 'Home page' },
      { url: internal, title: '' }
    ]
  );
  assert.equal(
    restoreFavorites(
      Array.from({ length: 20 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: 'x'.repeat(600)
      }))
    ).length,
    20
  );
  assert.equal(restoreFavorites([{ url: a, title: 'x'.repeat(600) }])[0].title.length, 512);
});

test('favorites persist and broadcast independently of recents, stale saves and page bindings', async context => {
  const { chrome, request, sender, settingsRequest } = await background(context, {
    [FAVORITES_KEY]: [{ url: b, title: 'Saved before restart' }]
  });
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  await request('PANEL_NAVIGATE', { input: a });
  const before = await request('PANEL_READY');
  const expected = [
    { url: a, title: 'Home' },
    { url: b, title: 'Saved before restart' }
  ];
  assert.deepEqual(await request('PANEL_ADD_FAVORITE', { url: a, title: 'Home' }), expected);
  await request('PANEL_SAVE', { state: before });
  await settingsRequest('SETTINGS_CLEAR_RECENT');
  await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  const after = await request('PANEL_READY');
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.favorites, expected);
  assert.deepEqual((await request('PANEL_READY', {}, 2)).favorites, expected);
  assert.deepEqual(chrome.storage.local.values[FAVORITES_KEY], expected);
  assert(messages.some(message => message.type === 'favorites' && message.favorites.length === 2));
  await request('PANEL_CLOSE');
  assert.deepEqual((await request('PANEL_READY')).favorites, expected);
  await request('PANEL_REMOVE_FAVORITE', { url: a });
  assert.deepEqual((await request('PANEL_READY')).favorites, [expected[1]]);
  assert.equal((await request('PANEL_READY')).url, '');
});

test('favorite metadata uses the current exact page and cannot resurrect a removed favorite', async context => {
  const { request, settingsRequest } = await background(context);
  await assert.rejects(request('PANEL_ADD_FAVORITE', { url: a, title: 'Empty' }), {
    code: 'errorCurrentPage'
  });
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_RECENT_TITLE', { url: a, pageUrl: a, title: 'Source title' });
  await assert.rejects(request('PANEL_ADD_FAVORITE', { url: b, title: 'Wrong page' }), {
    code: 'errorCurrentPage'
  });
  assert.deepEqual(await request('PANEL_ADD_FAVORITE', { url: a, title: '' }), [
    { url: a, title: 'Source title' }
  ]);
  await request('PANEL_FAVORITE_TITLE', { url: b, title: 'Stale title' });
  await request('PANEL_CLEAR_RECENT');
  assert.deepEqual(await request('PANEL_FAVORITE_TITLE', { url: a, title: ' Updated\n title ' }), [
    { url: a, title: 'Updated title' }
  ]);
  const before = await request('PANEL_READY');
  await request('PANEL_REMOVE_FAVORITE', { url: a });
  await request('PANEL_SAVE', { state: before });
  assert.deepEqual(await request('PANEL_FAVORITE_TITLE', { url: a, title: 'Late' }), []);
  await assert.rejects(
    settingsRequest('PANEL_ADD_FAVORITE', { windowId: 1, url: a, title: 'Untrusted' }),
    { code: 'errorPanelOnly' }
  );
});

test('favorite writes are atomic, retryable, idempotent and serialize concurrent window additions', async context => {
  const { chrome, request } = await background(context);
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_NAVIGATE', { input: b }, 2);
  const original = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(
    request('PANEL_ADD_FAVORITE', { url: a, title: 'First' }),
    /Storage unavailable/
  );
  assert.deepEqual((await request('PANEL_READY')).favorites, []);
  chrome.storage.local.set = original;
  await Promise.all([
    request('PANEL_ADD_FAVORITE', { url: a, title: 'First' }),
    request('PANEL_ADD_FAVORITE', { url: b, title: 'Second' }, 2),
    request('PANEL_ADD_FAVORITE', { url: a, title: 'Duplicate' })
  ]);
  const expected = [
    { url: b, title: 'Second' },
    { url: a, title: 'First' }
  ];
  assert.deepEqual((await request('PANEL_READY')).favorites, expected);
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(request('PANEL_REMOVE_FAVORITE', { url: a }), /Storage unavailable/);
  assert.deepEqual((await request('PANEL_READY')).favorites, expected);
  chrome.storage.local.set = original;
  await request('PANEL_REMOVE_FAVORITE', { url: a });
  assert.deepEqual(await request('PANEL_REMOVE_FAVORITE', { url: a }), [expected[0]]);
});

test('favorite names and order persist and broadcast without changing navigation or recent records', async context => {
  const { chrome, request, sender, settingsRequest } = await background(context, {
    [FAVORITES_KEY]: [
      { url: a, title: 'Page A' },
      { url: b, title: 'Page B' }
    ]
  });
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  await request('PANEL_NAVIGATE', { input: a });
  const before = await request('PANEL_READY');
  await request('PANEL_RENAME_FAVORITE', { url: b, title: ' My\n reference ' });
  await request('PANEL_MOVE_FAVORITE', { url: b, targetUrl: a, position: 'before' });
  await request('PANEL_NAVIGATE', { input: b }, 2);
  await request('PANEL_FAVORITE_TITLE', { url: b, title: 'Changed page title' }, 2);
  // A late navigation snapshot cannot replace either saved names or manual order.
  await request('PANEL_SAVE', { state: before });
  const expected = [
    { url: b, title: 'Changed page title', customTitle: 'My reference' },
    { url: a, title: 'Page A' }
  ];
  const after = await request('PANEL_READY');
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.recentUrls, [b, a]);
  assert.deepEqual(after.favorites, expected);
  assert.deepEqual((await request('PANEL_READY', {}, 2)).favorites, expected);
  assert.deepEqual(restoreFavorites(chrome.storage.local.values[FAVORITES_KEY]), expected);
  assert.deepEqual(
    messages.filter(message => message.type === 'favorites').at(-1).favorites,
    expected
  );
  for (const type of ['PANEL_RENAME_FAVORITE', 'PANEL_MOVE_FAVORITE']) {
    await assert.rejects(
      settingsRequest(type, {
        windowId: 1,
        url: a,
        title: 'Untrusted',
        targetUrl: b,
        position: 'before'
      }),
      { code: 'errorPanelOnly' }
    );
  }
});

test('favorite edits are atomic and no-op moves or stale edits do not write or resurrect entries', async context => {
  const initial = [
    { url: a, title: 'Page A' },
    { url: b, title: 'Page B' }
  ];
  const { chrome, request } = await background(context, { [FAVORITES_KEY]: initial });
  const original = chrome.storage.local.set;
  let writes = 0;
  chrome.storage.local.set = async () => {
    writes++;
    throw new Error('Storage unavailable');
  };
  await request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: b, position: 'before' });
  await request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: internal, position: 'after' });
  await request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: b, position: 'invalid' });
  await request('PANEL_RENAME_FAVORITE', { url: internal, title: 'Deleted' });
  assert.equal(writes, 0);
  await assert.rejects(request('PANEL_RENAME_FAVORITE', { url: a, title: '  ' }), {
    code: 'errorFavoriteName'
  });
  await assert.rejects(
    request('PANEL_RENAME_FAVORITE', { url: a, title: 'Mine' }),
    /Storage unavailable/
  );
  await assert.rejects(
    request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: b, position: 'after' }),
    /Storage unavailable/
  );
  assert.deepEqual((await request('PANEL_READY')).favorites, initial);
  chrome.storage.local.set = original;
  await request('PANEL_RENAME_FAVORITE', { url: a, title: 'Mine' });
  await request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: b, position: 'after' });
  await request('PANEL_REMOVE_FAVORITE', { url: a });
  await request('PANEL_RENAME_FAVORITE', { url: a, title: 'Late name' });
  await request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: b, position: 'before' });
  assert.deepEqual((await request('PANEL_READY')).favorites, [initial[1]]);
});

test('concurrent favorite moves preserve newer additions, names and removals from other windows', async context => {
  const { request } = await background(context, {
    [FAVORITES_KEY]: [
      { url: a, title: 'Page A' },
      { url: b, title: 'Page B' }
    ]
  });
  await request('PANEL_NAVIGATE', { input: internal }, 2);
  await Promise.all([
    request('PANEL_ADD_FAVORITE', { url: internal, title: 'New page' }, 2),
    request('PANEL_RENAME_FAVORITE', { url: a, title: 'My A' }, 2),
    request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: b, position: 'after' })
  ]);
  assert.deepEqual((await request('PANEL_READY')).favorites, [
    { url: internal, title: 'New page' },
    { url: b, title: 'Page B' },
    { url: a, title: 'Page A', customTitle: 'My A' }
  ]);
  await Promise.all([
    request('PANEL_REMOVE_FAVORITE', { url: b }, 2),
    request('PANEL_MOVE_FAVORITE', { url: a, targetUrl: b, position: 'before' })
  ]);
  assert.deepEqual(
    (await request('PANEL_READY')).favorites.map(item => item.url),
    [internal, a]
  );
});

test('favorite settings accept the anchored options page, sync edits and preserve browsing', async context => {
  const initial = [
    { url: a, title: 'Page A' },
    { url: b, title: 'Page B' }
  ];
  const { chrome, request, settingsRequest, sender } = await background(context, {
    [FAVORITES_KEY]: initial
  });
  const from = {
    id: 'test',
    url: 'chrome-extension://test/options.html#favorites',
    tab: { id: 42 }
  };
  const edit = (type, data = {}) => settingsRequest(type, data, from);
  await request('PANEL_NAVIGATE', { input: a });
  const before = await request('PANEL_READY');
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:1',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  assert.deepEqual((await edit('SETTINGS_GET')).favorites, initial);
  await edit('SETTINGS_RENAME_FAVORITE', { url: b, title: 'Reference' });
  const moved = await edit('SETTINGS_MOVE_FAVORITE', { url: b, targetUrl: a, position: 'before' });
  assert.deepEqual(moved.favorites, [{ ...initial[1], customTitle: 'Reference' }, initial[0]]);
  assert.deepEqual((await request('PANEL_READY')).favorites, moved.favorites);
  assert.deepEqual(chrome.storage.local.values[FAVORITES_KEY], moved.favorites);
  assert.deepEqual(
    messages.filter(message => message.type === 'favorites').at(-1).favorites,
    moved.favorites
  );
  const original = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(edit('SETTINGS_REMOVE_FAVORITE', { url: a }), /Storage unavailable/);
  assert.deepEqual((await edit('SETTINGS_GET')).favorites, moved.favorites);
  chrome.storage.local.set = original;
  const removed = await edit('SETTINGS_REMOVE_FAVORITE', { url: a });
  assert.deepEqual(removed.favorites, [moved.favorites[0]]);
  assert.deepEqual(
    (await edit('SETTINGS_RENAME_FAVORITE', { url: a, title: 'Late' })).favorites,
    removed.favorites
  );
  const after = await request('PANEL_READY');
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.recentUrls, before.recentUrls);
  for (const invalid of [
    sender,
    { ...from, id: 'other' },
    { ...from, url: 'https://example.com/options.html#favorites' },
    { ...from, url: 'chrome-extension://test/options.html.evil#favorites' },
    { ...from, url: 'chrome-extension://test/help.html#favorites' }
  ]) {
    for (const type of [
      'SETTINGS_RENAME_FAVORITE',
      'SETTINGS_UPDATE_FAVORITE',
      'SETTINGS_MOVE_FAVORITE',
      'SETTINGS_REMOVE_FAVORITE'
    ]) {
      await assert.rejects(
        settingsRequest(
          type,
          { url: b, title: 'Rejected', targetUrl: a, position: 'after' },
          invalid
        ),
        { code: 'errorSettingsOnly' }
      );
    }
  }
});

test('name and URL edits commit atomically, reject conflicts and leave live navigation intact', async context => {
  const initial = [
    { url: a, title: 'Page A' },
    { url: b, title: 'Page B' }
  ];
  const { chrome, request, settingsRequest, sender } = await background(context, {
    [FAVORITES_KEY]: initial
  });
  await request('PANEL_NAVIGATE', { input: a });
  const before = await request('PANEL_READY');
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:1',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  const edit = (newUrl, title = 'Updated name') =>
    settingsRequest('SETTINGS_UPDATE_FAVORITE', { url: a, newUrl, title });
  await assert.rejects(edit('https://B.EXAMPLE'), { code: 'errorFavoriteDuplicate' });
  await assert.rejects(edit('javascript:alert(1)'), { code: 'errorFavoriteUrl' });
  await assert.rejects(edit(internal, '  '), { code: 'errorFavoriteName' });
  const original = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(edit(internal), /Storage unavailable/);
  assert.deepEqual((await request('PANEL_READY')).favorites, initial);
  assert.deepEqual(chrome.storage.local.values[FAVORITES_KEY], initial);
  assert.equal(messages.filter(message => message.type === 'favorites').length, 0);
  chrome.storage.local.set = original;
  await Promise.all([
    settingsRequest('SETTINGS_RENAME_FAVORITE', { url: b, title: 'Other window' }),
    edit(internal)
  ]);
  // A queued title report and an old navigation snapshot cannot restore the old address.
  await request('PANEL_FAVORITE_TITLE', { url: a, title: 'Old title update' });
  await request('PANEL_SAVE', { state: before });
  const expected = [
    { url: internal, title: '', customTitle: 'Updated name' },
    { url: b, title: 'Page B', customTitle: 'Other window' }
  ];
  const after = await request('PANEL_READY');
  assert.deepEqual(after.favorites, expected);
  assert.deepEqual(restoreFavorites(chrome.storage.local.values[FAVORITES_KEY]), expected);
  assert.deepEqual((await request('PANEL_READY', {}, 2)).favorites, expected);
  assert.deepEqual(
    messages.filter(message => message.type === 'favorites').at(-1).favorites,
    expected
  );
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.recentUrls, before.recentUrls);
  await assert.rejects(edit(a), { code: 'errorFavoriteMissing' });
  assert.deepEqual((await request('PANEL_READY')).favorites, expected);
});

test('settings change the shared mode and clear recents without replacing window navigation', async context => {
  const { chrome, request, sender, settingsRequest } = await background(context);
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_NAVIGATE', { input: b }, 2);
  const first = await request('PANEL_READY');
  const second = await request('PANEL_READY', {}, 2);
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  assert.deepEqual(await settingsRequest('SETTINGS_GET'), {
    favorites: [],
    returnHomeAfterOpen: true,
    mode: 'desktop',
    sitePreferences: {},
    theme: 'system',
    searchEngine: 'google',
    customSearchEngine: null,
    recentCount: 2
  });
  assert.deepEqual(await settingsRequest('SETTINGS_MODE', { mode: 'mobile' }), {
    favorites: [],
    returnHomeAfterOpen: true,
    mode: 'mobile',
    sitePreferences: {},
    theme: 'system',
    searchEngine: 'google',
    customSearchEngine: null,
    recentCount: 2
  });
  assert.equal(chrome.storage.local.values[MODE_KEY], 'mobile');
  assert(
    messages.some(message => message.type === 'preferences' && message.defaultMode === 'mobile')
  );
  assert.deepEqual(await settingsRequest('SETTINGS_CLEAR_RECENT'), {
    favorites: [],
    returnHomeAfterOpen: true,
    mode: 'mobile',
    sitePreferences: {},
    theme: 'system',
    searchEngine: 'google',
    customSearchEngine: null,
    recentCount: 0
  });
  await request('PANEL_SAVE', { state: first });
  for (const [id, before] of [
    [1, first],
    [2, second]
  ]) {
    const after = await request('PANEL_READY', {}, id);
    assert.equal(after.mode, 'mobile');
    assert.equal(after.url, before.url);
    assert.deepEqual(after.history, before.history);
    assert.deepEqual(after.recentUrls, []);
  }
  assert.deepEqual(chrome.storage.local.values[RECENT_TITLES_KEY], {});
  assert(messages.some(message => message.type === 'recent' && message.urls.length === 0));
});

test('closing a page persists an empty window without clearing recents or another window', async context => {
  const { chrome, request, settingsRequest } = await background(context);
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_RECENT_TITLE', { url: a, pageUrl: a, title: 'Page A' });
  await request('PANEL_NAVIGATE', { input: internal });
  const second = await request('PANEL_NAVIGATE', { input: b }, 2);
  const before = await request('PANEL_READY');
  const closed = await request('PANEL_CLOSE');
  const empty = { url: '', mode: 'desktop', history: [], historyIndex: -1 };
  assert.deepEqual(closed, { ...pageState(before), ...empty });
  assert.deepEqual(chrome.storage.local.values[LAST_KEY], empty);
  assert.deepEqual(chrome.storage.session.values[WINDOWS_KEY][1], empty);
  assert.deepEqual(pageState(await request('PANEL_READY')), closed);
  assert.deepEqual(pageState(await request('PANEL_READY', {}, 2)), pageState(second));
  assert.deepEqual(pageState(await request('PANEL_READY', {}, 3)), closed);
  assert.deepEqual(await request('PANEL_CLOSE'), closed);
  await request('PANEL_RECENT_TITLE', { url: a, pageUrl: a, title: 'Late title' });
  assert.deepEqual((await request('PANEL_READY')).recentTitles, before.recentTitles);
  await assert.rejects(settingsRequest('PANEL_CLOSE', { windowId: 2 }), {
    code: 'errorPanelOnly'
  });
  assert.deepEqual(pageState(await request('PANEL_READY', {}, 2)), pageState(second));
  const reopened = await request('PANEL_NAVIGATE', { input: a });
  assert.equal(reopened.url, a);
  assert.deepEqual(reopened.history, [a]);
  assert.equal(reopened.historyIndex, 0);
});

test('settings operations require the settings page and do not grant panel navigation access', async context => {
  const { request, sender, settingsRequest } = await background(context, { [RECENT_KEY]: [a] });
  for (const from of [
    sender,
    { id: 'test', url: 'https://example.com/' },
    { id: 'other', url: 'chrome-extension://test/options.html' },
    { id: 'test', url: 'chrome-extension://test/help.html' }
  ]) {
    await assert.rejects(settingsRequest('SETTINGS_CLEAR_RECENT', {}, from), {
      code: 'errorSettingsOnly'
    });
    await assert.rejects(settingsRequest('SETTINGS_THEME', { theme: 'dark' }, from), {
      code: 'errorSettingsOnly'
    });
  }
  await assert.rejects(settingsRequest('PANEL_NAVIGATE', { windowId: 1, input: b }), {
    code: 'errorPanelOnly'
  });
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [a]);
});

test('theme changes persist independently of window navigation and recover from failed writes', async context => {
  const { chrome, request, settingsRequest } = await background(context, { [THEME_KEY]: 'dark' });
  assert.equal((await settingsRequest('SETTINGS_GET')).theme, 'dark');
  const first = await request('PANEL_NAVIGATE', { input: a });
  const second = await request('PANEL_NAVIGATE', { input: b }, 2);
  for (const theme of ['light', 'dark', 'system']) {
    assert.equal((await settingsRequest('SETTINGS_THEME', { theme })).theme, theme);
    assert.equal(chrome.storage.local.values[THEME_KEY], theme);
    assert.deepEqual(pageState(await request('PANEL_READY')), {
      ...pageState(first),
      recentUrls: [b, a]
    });
    assert.deepEqual(pageState(await request('PANEL_READY', {}, 2)), pageState(second));
  }
  const original = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(settingsRequest('SETTINGS_THEME', { theme: 'dark' }), /Storage unavailable/);
  assert.equal((await settingsRequest('SETTINGS_GET')).theme, 'system');
  assert.equal(chrome.storage.local.values[THEME_KEY], 'system');
  chrome.storage.local.set = original;
  assert.equal((await settingsRequest('SETTINGS_THEME', { theme: 'dark' })).theme, 'dark');
});

test('panel theme selection shares settings persistence and requires a native panel sender', async context => {
  const { chrome, request, settingsRequest } = await background(context);
  const before = await request('PANEL_NAVIGATE', { input: a });
  for (const theme of ['dark', 'light', 'system']) {
    assert.equal(await request('PANEL_THEME', { theme }), theme);
    assert.equal((await settingsRequest('SETTINGS_GET')).theme, theme);
    assert.equal(chrome.storage.local.values[THEME_KEY], theme);
    assert.deepEqual(pageState(await request('PANEL_READY')), pageState(before));
  }
  for (const from of [
    { id: 'test', url: 'chrome-extension://test/options.html' },
    { id: 'test', url: 'chrome-extension://test/sidepanel.html', tab: { id: 42 } },
    { id: 'test', url: 'https://example.com/' }
  ]) {
    await assert.rejects(settingsRequest('PANEL_THEME', { windowId: 1, theme: 'dark' }, from), {
      code: 'errorPanelOnly'
    });
  }
  assert.equal((await settingsRequest('SETTINGS_GET')).theme, 'system');
});

test('unknown theme preferences fall back to following the system', async context => {
  const { settingsRequest } = await background(context, { [THEME_KEY]: 'unknown' });
  assert.equal((await settingsRequest('SETTINGS_GET')).theme, 'system');
  assert.equal((await settingsRequest('SETTINGS_THEME', { theme: 'unknown' })).theme, 'system');
});

test('a failed default layout write preserves the preference and can be retried', async context => {
  const { chrome, settingsRequest } = await background(context);
  const original = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(settingsRequest('SETTINGS_MODE', { mode: 'mobile' }), /Storage unavailable/);
  assert.equal((await settingsRequest('SETTINGS_GET')).mode, 'desktop');
  assert.equal(chrome.storage.local.values[MODE_KEY], 'desktop');
  chrome.storage.local.set = original;
  assert.equal((await settingsRequest('SETTINGS_MODE', { mode: 'mobile' })).mode, 'mobile');
});

test('restore, internal location reports and history traversal never populate recent addresses', async context => {
  const { request } = await background(context, { [LAST_KEY]: { url: a, history: [a] } });
  let state = await request('PANEL_READY');
  assert.deepEqual(state.recentUrls, []);
  commitPanelNavigation(state, internal);
  state = await request('PANEL_SAVE', { state });
  navigatePanel(state, a, 0);
  state = await request('PANEL_SAVE', { state });
  assert.deepEqual(state.recentUrls, []);
  state = await request('PANEL_NAVIGATE', { input: b });
  commitPanelNavigation(state, `${b}redirected`, true);
  state = await request('PANEL_SAVE', { state });
  assert.deepEqual(state.recentUrls, [b]);
  assert.equal(state.url, `${b}redirected`);
});

test('address/search, current page, context menu and command actions share the explicit recent list', async context => {
  const { request, chrome } = await background(context);
  await request('PANEL_NAVIGATE', { input: b });
  await request('PANEL_CURRENT');
  chrome.contextMenus.onClicked.emit(
    { menuItemId: 'open-pocket', linkUrl: internal },
    { windowId: 1 }
  );
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [internal, a, b]);
  chrome.commands.onCommand.emit('open-current', { windowId: 1, url: b });
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [b, internal, a]);
  const state = await request('PANEL_NAVIGATE', { input: 'some search' });
  assert.equal(state.recentUrls[0], 'https://www.google.com/search?q=some%20search');
  await assert.rejects(request('PANEL_NAVIGATE', { input: 'javascript:alert(1)' }), {
    code: 'errorUnsupportedScheme'
  });
  assert.deepEqual((await request('PANEL_READY')).recentUrls, state.recentUrls);
});

test('recent addresses are shared and broadcast while window navigation stays independent', async context => {
  const { request, chrome, sender } = await background(context);
  await request('PANEL_READY', {}, 2);
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  await request('PANEL_NAVIGATE', { input: a });
  const second = await request('PANEL_READY', {}, 2);
  assert.equal(second.url, '');
  assert.deepEqual(second.recentUrls, [a]);
  assert(messages.some(message => message.type === 'recent' && message.urls[0] === a));
  await request('PANEL_NAVIGATE', { input: b }, 2);
  assert.equal((await request('PANEL_READY')).url, a);
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [b, a]);
});

test('refused destinations open in a new tab without becoming the page or a recent entry', async context => {
  const { request, chrome } = await background(context, {
    [LAST_KEY]: { url: a, history: [a] },
    [RETURN_HOME_AFTER_OPEN_KEY]: false
  });
  const created = [];
  chrome.tabs.create = async options => created.push(options);
  const before = await request('PANEL_READY');
  assert.equal((await request('PANEL_OPEN_TAB', { url: b })).url, a);
  assert.deepEqual(created, [{ windowId: 1, url: b, active: true }]);
  await assert.rejects(request('PANEL_OPEN_TAB', { url: 'javascript:alert(1)' }), {
    code: 'errorUnsupportedUrl'
  });
  assert.equal(created.length, 1);
  const after = await request('PANEL_READY');
  assert.equal(after.url, before.url);
  assert.deepEqual(after.recentUrls, before.recentUrls);
});

test('opening in the current main tab targets the active tab in the panel window and preserves side pages', async context => {
  const { request, chrome } = await background(context, { [RETURN_HOME_AFTER_OPEN_KEY]: false });
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_NAVIGATE', { input: b }, 2);
  const first = await request('PANEL_READY');
  const second = await request('PANEL_READY', {}, 2);
  const stored = structuredClone([chrome.storage.local.values, chrome.storage.session.values]);
  const queries = [];
  chrome.tabs.query = async options => {
    queries.push(options);
    return [{ id: options.windowId === 2 ? 21 : 11, windowId: options.windowId }];
  };
  const updates = [];
  chrome.tabs.update = async (id, options) => updates.push({ id, ...options });
  chrome.tabs.create = () => assert.fail('Opening in the current tab must not create a tab');
  assert.equal((await request('PANEL_OPEN_CURRENT_TAB', { tabId: null, url: internal })).url, a);
  assert.equal((await request('PANEL_OPEN_CURRENT_TAB', { tabId: null }, 2)).url, b);
  assert.deepEqual(updates, [
    { id: 11, url: a },
    { id: 21, url: b }
  ]);
  assert.deepEqual(queries, [
    { active: true, windowId: 1 },
    { active: true, windowId: 2 }
  ]);
  assert.deepEqual(pageState(await request('PANEL_READY')), pageState(first));
  assert.deepEqual(pageState(await request('PANEL_READY', {}, 2)), pageState(second));
  assert.deepEqual([chrome.storage.local.values, chrome.storage.session.values], stored);
});

test('opening bound and shared side pages in the main tab preserves bindings and navigation', async context => {
  const { request, chrome } = await background(context, { [RETURN_HOME_AFTER_OPEN_KEY]: false });
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  await request('PANEL_NAVIGATE', { input: b, tabId: null });
  const stored = structuredClone([chrome.storage.local.values, chrome.storage.session.values]);
  const updates = [];
  chrome.tabs.update = async (id, options) => updates.push({ id, ...options });
  chrome.tabs.create = () => assert.fail('Opening a bound page must keep the current tab');
  await request('PANEL_OPEN_CURRENT_TAB', { tabId: 10 });
  chrome.tabs.query = async ({ windowId }) => [{ id: 11, windowId }];
  await request('PANEL_OPEN_CURRENT_TAB', { tabId: null });
  assert.deepEqual(updates, [
    { id: 10, url: a },
    { id: 11, url: b }
  ]);
  assert.deepEqual([chrome.storage.local.values, chrome.storage.session.values], stored);
});

test('opening in the current tab rejects missing targets and untrusted callers and can retry tab failures', async context => {
  const { request, chrome, settingsRequest } = await background(context);
  const updates = [];
  chrome.tabs.update = async (id, options) => updates.push({ id, ...options });
  await assert.rejects(request('PANEL_OPEN_CURRENT_TAB', { tabId: null }), {
    code: 'errorCurrentPage'
  });
  await request('PANEL_NAVIGATE', { input: a });
  const before = await request('PANEL_READY');
  const stored = structuredClone([chrome.storage.local.values, chrome.storage.session.values]);
  await assert.rejects(settingsRequest('PANEL_OPEN_CURRENT_TAB', { windowId: 1, tabId: null }), {
    code: 'errorPanelOnly'
  });
  const query = chrome.tabs.query;
  for (const targets of [[], [{ windowId: 1 }], [{ id: 20, windowId: 2 }]]) {
    chrome.tabs.query = async () => targets;
    await assert.rejects(request('PANEL_OPEN_CURRENT_TAB', { tabId: null }), {
      code: 'errorCurrentPage'
    });
  }
  assert.deepEqual(updates, []);
  chrome.tabs.query = query;
  chrome.tabs.update = async () => {
    throw new Error('Tab closed');
  };
  await assert.rejects(request('PANEL_OPEN_CURRENT_TAB', { tabId: null }), /Tab closed/);
  assert.deepEqual(await request('PANEL_READY'), before);
  assert.deepEqual([chrome.storage.local.values, chrome.storage.session.values], stored);
  chrome.tabs.update = async (id, options) => updates.push({ id, ...options });
  const opened = await request('PANEL_OPEN_CURRENT_TAB', { tabId: null });
  assert.deepEqual(updates, [{ id: 10, url: a }]);
  assert.equal(opened.url, '');
  assert.deepEqual(opened.history, []);
  assert.deepEqual(opened.recentUrls, before.recentUrls);
});

test('all browser-tab opening actions return the shared page home only after success by default', async context => {
  for (const type of ['PANEL_EXTERNAL', 'PANEL_OPEN_CURRENT_TAB', 'PANEL_OPEN_TAB']) {
    const { request, chrome, settingsRequest } = await background(context, {
      [FAVORITES_KEY]: [{ url: a, title: 'Saved' }]
    });
    assert.equal((await settingsRequest('SETTINGS_GET')).returnHomeAfterOpen, true);
    await request('PANEL_NAVIGATE', { input: a });
    await request('PANEL_NAVIGATE', { input: b }, 2);
    const before = await request('PANEL_READY');
    const other = await request('PANEL_READY', {}, 2);
    const stored = structuredClone([chrome.storage.local.values, chrome.storage.session.values]);
    const method = type === 'PANEL_OPEN_CURRENT_TAB' ? 'update' : 'create';
    chrome.tabs[method] = async () => {
      throw new Error('Cannot open tab');
    };
    await assert.rejects(request(type, { tabId: null, url: internal }), /Cannot open tab/);
    assert.deepEqual(await request('PANEL_READY'), before);
    assert.deepEqual([chrome.storage.local.values, chrome.storage.session.values], stored);
    let openedUrl;
    chrome.tabs[method] = async (...args) => {
      assert.equal(chrome.storage.session.values[WINDOWS_KEY][1].url, a);
      openedUrl = args.at(-1).url;
    };
    const opened = await request(type, { tabId: null, url: internal });
    assert.equal(openedUrl, type === 'PANEL_OPEN_TAB' ? internal : a);
    assert.equal(opened.url, '');
    assert.deepEqual(opened.history, []);
    assert.equal(opened.historyIndex, -1);
    assert.deepEqual(opened.recentUrls, before.recentUrls);
    assert.deepEqual(opened.favorites, before.favorites);
    assert.equal(chrome.storage.session.values[WINDOWS_KEY][1].url, '');
    assert.equal(chrome.storage.local.values[LAST_KEY].url, '');
    assert.equal(chrome.storage.local.values[RETURN_HOME_AFTER_OPEN_KEY], undefined);
    assert.deepEqual(await request('PANEL_READY', {}, 2), other);
    const restarted = await background(
      context,
      chrome.storage.local.values,
      chrome.storage.session.values
    );
    assert.equal((await restarted.request('PANEL_READY')).url, '');
  }
});

test('returning a bound page home after opening it preserves its binding and other side pages', async context => {
  const { request, chrome } = await background(context);
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  await request('PANEL_NAVIGATE', { input: b, tabId: null });
  await request('PANEL_NAVIGATE', { input: internal }, 2);
  for (const type of ['PANEL_EXTERNAL', 'PANEL_OPEN_CURRENT_TAB', 'PANEL_OPEN_TAB']) {
    await request('PANEL_NAVIGATE', { input: a, tabId: 10 });
    const before = await request('PANEL_READY');
    const shared = structuredClone(chrome.storage.session.values[WINDOWS_KEY]);
    const opened = await request(type, { tabId: 10, url: a });
    assert.equal(opened.tabId, 10);
    assert.equal(opened.url, '');
    assert.deepEqual(opened.history, []);
    assert.deepEqual(opened.recentUrls, before.recentUrls);
    assert.equal(chrome.storage.session.values[BINDINGS_KEY][10].state.url, '');
    assert.deepEqual(chrome.storage.session.values[WINDOWS_KEY], shared);
  }
});

test('the return-home setting is shared, persisted and does not change any live page when toggled', async context => {
  const { request, chrome, settingsRequest } = await background(context);
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_NAVIGATE', { input: b }, 2);
  const before = [await request('PANEL_READY'), await request('PANEL_READY', {}, 2)];
  const originalSession = structuredClone(chrome.storage.session.values);
  const change = enabled =>
    settingsRequest('SETTINGS_RETURN_HOME_AFTER_OPEN', { returnHomeAfterOpen: enabled });
  assert.equal((await change(false)).returnHomeAfterOpen, false);
  assert.equal(chrome.storage.local.values[RETURN_HOME_AFTER_OPEN_KEY], false);
  // Navigation snapshots, even ones containing a stale preference, cannot overwrite it.
  await request('PANEL_SAVE', { state: { ...before[0], returnHomeAfterOpen: true } });
  for (const type of ['PANEL_EXTERNAL', 'PANEL_OPEN_CURRENT_TAB', 'PANEL_OPEN_TAB']) {
    for (const windowId of [1, 2]) {
      const result = await request(type, { tabId: null, url: internal }, windowId);
      assert.deepEqual(result, pageState(before[windowId - 1]));
    }
  }
  assert.deepEqual(chrome.storage.session.values, originalSession);
  assert.equal((await change(true)).returnHomeAfterOpen, true);
  assert.deepEqual(await request('PANEL_READY'), before[0]);
  assert.deepEqual(await request('PANEL_READY', {}, 2), before[1]);
  await change(false);
  const restarted = await background(
    context,
    chrome.storage.local.values,
    chrome.storage.session.values
  );
  assert.equal((await restarted.settingsRequest('SETTINGS_GET')).returnHomeAfterOpen, false);
  assert.equal((await restarted.request('PANEL_EXTERNAL', { tabId: null })).url, a);
});

test('return-home preference rejects unauthorized or invalid writes and retains its value after failed saves', async context => {
  const { request, chrome, settingsRequest, sender } = await background(context);
  const change = enabled =>
    settingsRequest('SETTINGS_RETURN_HOME_AFTER_OPEN', { returnHomeAfterOpen: enabled });
  await assert.rejects(
    settingsRequest('SETTINGS_RETURN_HOME_AFTER_OPEN', { returnHomeAfterOpen: false }, sender),
    { code: 'errorSettingsOnly' }
  );
  await assert.rejects(change('false'), { code: 'errorUnknownOperation' });
  const original = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(change(false), /Storage unavailable/);
  assert.equal((await settingsRequest('SETTINGS_GET')).returnHomeAfterOpen, true);
  assert.equal(chrome.storage.local.values[RETURN_HOME_AFTER_OPEN_KEY], undefined);
  chrome.storage.local.set = original;
  await change(false);
  await request('PANEL_NAVIGATE', { input: a });
  // A queued preference change must be in force before an opening action runs.
  const saving = change(true);
  const opening = request('PANEL_EXTERNAL', { tabId: null });
  await saving;
  assert.equal((await opening).url, '');
});

test('missing or invalid stored return-home preferences use the enabled default', async context => {
  for (const value of [undefined, null, 0, 'false']) {
    const { settingsRequest } = await background(context, { [RETURN_HOME_AFTER_OPEN_KEY]: value });
    assert.equal((await settingsRequest('SETTINGS_GET')).returnHomeAfterOpen, true);
  }
});

test('clearing stays persisted after stale saves, reloads, external opens and reopening the same URL', async context => {
  const { request, chrome } = await background(context, {
    [RETURN_HOME_AFTER_OPEN_KEY]: false,
    [RECENT_KEY]: [a, b],
    [LAST_KEY]: { url: a, history: [a] }
  });
  const before = await request('PANEL_READY');
  await request('PANEL_CLEAR_RECENT');
  await request('PANEL_SAVE', { state: before });
  await request('PANEL_MODE', { mode: 'desktop' });
  await request('PANEL_EXTERNAL');
  assert.deepEqual(chrome.storage.local.values[RECENT_KEY], []);
  const after = await request('PANEL_READY');
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.recentUrls, []);
  assert.deepEqual((await request('PANEL_CURRENT')).recentUrls, [a]);
  assert.deepEqual(chrome.storage.local.values[RECENT_KEY], [a]);
});

test('removing one recent entry preserves other paths, window navigation and deletion across stale saves', async context => {
  const { request, chrome, sender } = await background(context, {
    [RECENT_KEY]: [a, internal, b],
    [LAST_KEY]: { url: a, history: [a, internal], historyIndex: 0 }
  });
  const before = await request('PANEL_READY');
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  assert.deepEqual(await request('PANEL_REMOVE_RECENT', { url: a }), [internal, b]);
  const after = await request('PANEL_SAVE', { state: before });
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.equal(after.historyIndex, before.historyIndex);
  assert.deepEqual(after.recentUrls, [internal, b]);
  assert.deepEqual(chrome.storage.local.values[RECENT_KEY], [internal, b]);
  assert.deepEqual((await request('PANEL_READY', {}, 2)).recentUrls, [internal, b]);
  assert(
    messages.some(
      message =>
        message.type === 'recent' && JSON.stringify(message.urls) === JSON.stringify([internal, b])
    )
  );
  assert(!messages.some(message => message.type === 'navigate'));
});

test('removing the final entry is idempotent and queued explicit opens can add it again', async context => {
  const { request, chrome } = await background(context, {
    [RECENT_KEY]: [a],
    [LAST_KEY]: { url: a }
  });
  assert.deepEqual(await request('PANEL_REMOVE_RECENT', { url: a }), []);
  assert.deepEqual(await request('PANEL_REMOVE_RECENT', { url: a }), []);
  assert.deepEqual(chrome.storage.local.values[RECENT_KEY], []);
  await Promise.all([
    request('PANEL_REMOVE_RECENT', { url: a }),
    request('PANEL_NAVIGATE', { input: a }),
    request('PANEL_NAVIGATE', { input: b }, 2)
  ]);
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [b, a]);
  assert.deepEqual(chrome.storage.local.values[RECENT_KEY], [b, a]);
});

test('source tab titles are saved for current-page and command opens, never borrowed for another link', async context => {
  const { request, chrome } = await background(context);
  chrome.tabs.query = async () => [{ url: a, title: 'Home page' }];
  assert.equal((await request('PANEL_CURRENT')).recentTitles[a], 'Home page');
  chrome.contextMenus.onClicked.emit(
    { menuItemId: 'open-pocket', linkUrl: internal },
    { windowId: 1, url: a, title: 'Wrong source title' }
  );
  assert.equal((await request('PANEL_READY')).recentTitles[internal], undefined);
  chrome.commands.onCommand.emit('open-current', { windowId: 1, url: b, title: 'Second page' });
  assert.equal((await request('PANEL_READY')).recentTitles[b], 'Second page');
  await request('PANEL_NAVIGATE', { input: a });
  assert.equal((await request('PANEL_READY')).recentTitles[a], 'Home page');
});

test('loaded titles persist and broadcast without adding or reordering entries', async context => {
  const { request, chrome, sender } = await background(context, { [RECENT_KEY]: [a, b] });
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  const state = await request('PANEL_READY');
  commitPanelNavigation(state, internal);
  await request('PANEL_SAVE', { state });
  // A loaded redirect can supply the title for its existing explicit destination.
  assert.deepEqual(
    await request('PANEL_RECENT_TITLE', { url: a, pageUrl: internal, title: ' Loaded\n title ' }),
    { [a]: 'Loaded title' }
  );
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [a, b]);
  assert.deepEqual(chrome.storage.local.values[RECENT_TITLES_KEY], { [a]: 'Loaded title' });
  assert(
    messages.some(message => message.type === 'recent' && message.titles[a] === 'Loaded title')
  );
  assert(!messages.some(message => message.type === 'navigate'));
  await request('PANEL_RECENT_TITLE', {
    url: internal,
    pageUrl: internal,
    title: 'Unrecorded internal page'
  });
  await request('PANEL_RECENT_TITLE', { url: b, pageUrl: b, title: 'Stale page' });
  assert.deepEqual((await request('PANEL_READY')).recentTitles, { [a]: 'Loaded title' });
});

test('stored titles survive restoration and late metadata cannot restore removed entries', async context => {
  const { request, chrome } = await background(context, {
    [RECENT_KEY]: [a, b],
    [RECENT_TITLES_KEY]: { [a]: 'Home', [b]: 'Second', [internal]: 'Orphan' },
    [LAST_KEY]: { url: a }
  });
  const before = await request('PANEL_READY');
  assert.deepEqual(before.recentTitles, { [a]: 'Home', [b]: 'Second' });
  await request('PANEL_REMOVE_RECENT', { url: a });
  await request('PANEL_RECENT_TITLE', { url: a, pageUrl: a, title: 'Late title' });
  await request('PANEL_SAVE', { state: before });
  assert.deepEqual((await request('PANEL_READY')).recentTitles, { [b]: 'Second' });
  assert.deepEqual(chrome.storage.local.values[RECENT_TITLES_KEY], { [b]: 'Second' });
  await request('PANEL_CLEAR_RECENT');
  assert.deepEqual(chrome.storage.local.values[RECENT_TITLES_KEY], {});
});

test('context menu installation failure is logged and does not poison subsequent panel requests', async context => {
  const { chrome, request } = await background(context);
  const logs = [];
  context.mock.method(console, 'error', (...args) => logs.push(args));
  chrome.contextMenus.create = (_options, callback) => {
    chrome.runtime.lastError = { message: 'Menu creation failed' };
    callback();
    delete chrome.runtime.lastError;
  };
  chrome.runtime.onInstalled.emit();
  await request('PANEL_READY');
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[SideBrowser] Install context menu and migrate legacy state');
  assert.equal(logs[0][1].message, 'Menu creation failed');
  assert.equal((await request('PANEL_NAVIGATE', { input: a })).url, a);
});

test('missing legacy content script is expected during installation and still permits menu creation', async context => {
  const { chrome, request } = await background(context);
  chrome.storage.session.values['pocket-page-mount-v1'] = { tabId: 4, id: 'legacy' };
  chrome.tabs.sendMessage = async () => {
    throw new Error('No receiving end');
  };
  const logs = [];
  const menus = [];
  context.mock.method(console, 'error', (...args) => logs.push(args));
  chrome.contextMenus.create = (options, callback) => {
    menus.push(options);
    callback();
  };
  chrome.runtime.onInstalled.emit();
  await request('PANEL_READY');
  assert.equal(chrome.storage.session.values['pocket-page-mount-v1'], undefined);
  assert.equal(menus[0].id, 'open-pocket');
  assert.deepEqual(menus[1], {
    id: 'favorite-pocket',
    title: 'contextFavorite',
    contexts: ['page', 'frame', 'action'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  });
  assert.deepEqual(menus[2], {
    id: 'search-pocket',
    title: 'contextSearch',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  });
  assert.equal(menus.length, 3);
  assert.deepEqual(logs, []);
});

test('page, frame and action menus save the selected page without opening or navigating a panel', async context => {
  const { chrome, request } = await background(context);
  let opened = 0;
  chrome.sidePanel.open = async () => {
    opened++;
  };
  await request('PANEL_NAVIGATE', { input: internal });
  const before = await request('PANEL_READY');
  const click = (info, tab) =>
    chrome.contextMenus.onClicked.emit({ menuItemId: 'favorite-pocket', ...info }, tab);
  // The toolbar action uses its main tab even when a different page is open in the side panel.
  click({}, { id: 10, windowId: 1, url: a, title: 'Main tab' });
  assert.deepEqual((await request('PANEL_READY')).favorites, [{ url: a, title: 'Main tab' }]);
  // The menu captures its document URL even when the main tab has since navigated.
  click({ pageUrl: b }, { id: 10, windowId: 1, url: a, title: 'Wrong title' });
  click({ frameUrl: internal, pageUrl: a }, { id: 10, windowId: 1, url: a, title: 'Parent title' });
  click({ pageUrl: 'https://a.example' }, { url: a, title: 'Duplicate' });
  click({ pageUrl: 'chrome://settings' }, { url: a });
  click({}, undefined);
  const after = await request('PANEL_READY');
  assert.deepEqual(after.favorites, [
    { url: internal, title: '' },
    { url: b, title: '' },
    { url: a, title: 'Main tab' }
  ]);
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.recentUrls, before.recentUrls);
  assert.equal(opened, 0);
});

test('browser startup refreshes all context menu labels', async context => {
  const { chrome, request } = await background(context);
  const updates = [];
  chrome.contextMenus.update = async (id, properties) => {
    updates.push({ id, ...properties });
  };
  chrome.runtime.onStartup.emit();
  await request('PANEL_READY');
  assert.deepEqual(updates, [
    { id: 'open-pocket', title: 'contextOpen' },
    { id: 'favorite-pocket', title: 'contextFavorite' },
    { id: 'search-pocket', title: 'contextSearch' }
  ]);
});

test('selection searches encode text with each selected engine and open synchronously without changing the source tab', async context => {
  const { chrome, request, settingsRequest } = await background(context);
  const opened = [];
  chrome.sidePanel.open = async options => opened.push(options);
  context.mock.method(chrome.tabs, 'create', () => assert.fail('Search must stay in the sidebar'));
  const source = { id: 10, windowId: 1, url: a, title: 'Original article' };
  const engines = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    baidu: 'https://www.baidu.com/s?wd=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    'yahoo-japan': 'https://search.yahoo.co.jp/search?p='
  };
  for (const [engine, prefix] of Object.entries(engines)) {
    // The click must use the saved preference even while that write is still queued.
    const saving = settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: engine });
    for (const query of [
      'https://example.com/docs?q=one&lang=ja',
      'example.com/docs',
      'TypeError: 日本語 & 搜索\n at main.js:1\t#? + %s'
    ]) {
      const count = opened.length;
      chrome.contextMenus.onClicked.emit(
        { menuItemId: 'search-pocket', selectionText: `  ${query}\n`, linkUrl: b },
        source
      );
      assert.equal(opened.length, count + 1, 'open must happen before the click returns');
      assert.deepEqual(opened.at(-1), { windowId: 1 });
      const result = await request('PANEL_READY');
      const expected = prefix + encodeURIComponent(query);
      assert.equal(result.url, expected);
      assert.equal(result.recentUrls[0], expected);
      assert.equal(result.history.at(-1), expected);
      assert.equal(result.recentTitles[expected], undefined, 'do not borrow the article title');
    }
    await saving;
  }
  assert.deepEqual(source, { id: 10, windowId: 1, url: a, title: 'Original article' });
});

test('selection search opens during a cold worker start and waits for the saved custom engine', async context => {
  const opened = [];
  const query = '日本語 & error: 42';
  const { request } = await background(
    context,
    {
      [SEARCH_ENGINE_KEY]: 'custom',
      [CUSTOM_SEARCH_ENGINE_KEY]: {
        name: 'Saved search',
        url: 'https://example.com/search?q=%s&again=%s'
      }
    },
    {},
    chrome => {
      let release;
      const loading = new Promise(resolve => (release = resolve));
      const get = chrome.storage.local.get.bind(chrome.storage.local);
      chrome.storage.local.get = async keys => {
        await loading;
        return get(keys);
      };
      chrome.sidePanel.open = async options => opened.push(options);
      const clicks = chrome.contextMenus.onClicked;
      const addListener = clicks.addListener.bind(clicks);
      clicks.addListener = listener => {
        addListener(listener);
        clicks.emit(
          { menuItemId: 'search-pocket', selectionText: query },
          { id: 10, windowId: 1, url: a }
        );
        assert.deepEqual(opened, [{ windowId: 1 }]);
        release();
      };
    }
  );
  const encoded = encodeURIComponent(query);
  assert.equal(
    (await request('PANEL_READY')).url,
    `https://example.com/search?q=${encoded}&again=${encoded}`
  );
});

test('selection searches route to the source binding or shared page and preserve other pages and windows', async context => {
  const { chrome, request, sender } = await background(context);
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:1',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  await request('PANEL_NAVIGATE', { input: b, tabId: null });
  await request('PANEL_NAVIGATE', { input: internal }, 2);
  // Switching the active tab after the click must not redirect the search.
  chrome.tabs.query = async () => [{ id: 11, windowId: 1 }];
  chrome.contextMenus.onClicked.emit(
    { menuItemId: 'search-pocket', selectionText: 'bound', frameUrl: internal },
    { id: 10, windowId: 1, url: a }
  );
  assert.equal((await request('PANEL_READY')).url, b);
  const boundUrl = 'https://www.google.com/search?q=bound';
  assert.equal(chrome.storage.session.values[BINDINGS_KEY][10].state.url, boundUrl);
  assert(
    messages.some(m => m.type === 'navigate' && m.state.tabId === 10 && m.state.url === boundUrl)
  );
  chrome.tabs.query = async () => [{ id: 10, windowId: 1 }];
  chrome.contextMenus.onClicked.emit(
    { menuItemId: 'search-pocket', selectionText: 'shared' },
    { id: 11, windowId: 1, url: b }
  );
  assert.equal((await request('PANEL_READY')).url, boundUrl);
  assert.equal(
    chrome.storage.session.values[WINDOWS_KEY][1].url,
    'https://www.google.com/search?q=shared'
  );
  assert.equal(chrome.storage.session.values[WINDOWS_KEY][2].url, internal);
});

test('empty selections and clicks without a source window do not open or navigate', async context => {
  const { chrome, request } = await background(context, { [LAST_KEY]: { url: a } });
  const before = await request('PANEL_READY');
  chrome.sidePanel.open = () => assert.fail('Invalid selection must not open the sidebar');
  for (const selectionText of [undefined, '', ' \n\t '])
    chrome.contextMenus.onClicked.emit(
      { menuItemId: 'search-pocket', selectionText },
      { id: 10, windowId: 1, url: a }
    );
  for (const tab of [undefined, { id: 10, url: a }])
    chrome.contextMenus.onClicked.emit(
      { menuItemId: 'search-pocket', selectionText: 'words' },
      tab
    );
  assert.deepEqual(await request('PANEL_READY'), before);
});

test('only explicitly bound tabs are independent; all other tabs share one window page', async context => {
  const { chrome, request, sender, settingsRequest } = await background(context);
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:1',
    sender,
    onDisconnect: event(),
    postMessage: m => messages.push(m)
  });
  await request('PANEL_NAVIGATE', { input: a });
  const wiki = await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  assert.equal(wiki.tabId, 10);
  assert.equal(wiki.url, a);
  assert.deepEqual(wiki.history, [a]);
  chrome.tabs.query = async () => [{ id: 11, windowId: 1 }];
  assert.equal((await request('PANEL_READY')).tabId, null);
  assert.equal((await request('PANEL_READY')).url, '');
  assert.deepEqual((await request('PANEL_READY')).history, []);
  assert.equal(chrome.storage.session.values[WINDOWS_KEY][1].url, '');
  assert.equal(chrome.storage.local.values[LAST_KEY].url, '');
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [a]);
  await request('PANEL_NAVIGATE', { input: b });
  chrome.tabs.query = async () => [{ id: 12, windowId: 1 }];
  assert.equal((await request('PANEL_READY')).url, b);
  assert.equal((await request('PANEL_READY')).tabId, null);
  assert.equal(chrome.storage.session.values[BINDINGS_KEY][11], undefined);
  assert.equal(chrome.storage.session.values[BINDINGS_KEY][12], undefined);
  // A hidden bound document cannot overwrite the shared page.
  commitPanelNavigation(wiki, internal);
  await request('PANEL_SAVE', { state: wiki, tabId: 10 });
  assert.equal((await request('PANEL_READY')).url, b);
  chrome.tabs.query = async () => [{ id: 10, windowId: 1 }];
  assert.equal((await request('PANEL_READY')).url, internal);
  assert.equal((await request('PANEL_READY')).sourceTabId, 10);
  // A second explicit binding consumes the new shared page, without changing the first binding.
  await request('PANEL_BIND', { sourceTabId: 11, bound: true });
  assert.equal(chrome.storage.session.values[WINDOWS_KEY][1].url, '');
  await request('PANEL_NAVIGATE', { input: b, tabId: null });
  // Repeating an already applied binding does not consume a later shared page.
  await request('PANEL_BIND', { sourceTabId: 11, bound: true });
  assert.equal(chrome.storage.session.values[WINDOWS_KEY][1].url, b);
  await request('PANEL_NAVIGATE', { input: 'https://second.example/', tabId: 11 });
  const restored = await request('PANEL_BIND', { sourceTabId: 10, bound: false });
  assert.equal(restored.url, b);
  assert.equal(restored.tabId, null);
  assert.equal(chrome.storage.session.values[BINDINGS_KEY][10], undefined);
  assert.equal(
    chrome.storage.session.values[BINDINGS_KEY][11].state.url,
    'https://second.example/'
  );
  assert(messages.some(m => m.type === 'remove-tab' && m.tabId === 10));
  await assert.rejects(request('PANEL_SAVE', { state: wiki, tabId: 10 }), {
    code: 'errorCurrentPage'
  });
  assert.equal(chrome.storage.session.values[BINDINGS_KEY][10], undefined);
  assert.equal((await settingsRequest('SETTINGS_GET')).scope, undefined);
});

test('bindings restore after worker restart and closing a bound tab leaves the shared page intact', async context => {
  const saved = { url: a, mode: 'desktop', history: [a], historyIndex: 0 };
  const { chrome, request } = await background(
    context,
    { [LAST_KEY]: { ...saved, url: b, history: [b] } },
    {
      [BINDINGS_KEY]: { 10: { windowId: 1, state: saved } }
    }
  );
  assert.equal((await request('PANEL_READY')).url, a);
  chrome.tabs.query = async () => [{ id: 11, windowId: 1 }];
  chrome.tabs.onRemoved.emit(10, { windowId: 1, isWindowClosing: false });
  assert.equal((await request('PANEL_READY')).url, b);
  assert.equal(chrome.storage.session.values[BINDINGS_KEY][10], undefined);
});

test('binding changes reject other windows, remain atomic on failed storage and ignore the old global mode', async context => {
  const { chrome, request, settingsRequest } = await background(
    context,
    { 'pocket-sidepanel-scope-v1': 'tab' },
    {
      'pocket-sidepanel-tabs-v1': { 10: { windowId: 1, state: { url: a } } }
    }
  );
  assert.equal((await request('PANEL_READY')).tabId, null);
  const set = chrome.storage.session.set;
  chrome.storage.session.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(
    request('PANEL_BIND', { sourceTabId: 10, bound: true }),
    /Storage unavailable/
  );
  assert.equal((await request('PANEL_READY')).tabId, null);
  chrome.storage.session.set = set;
  await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  chrome.storage.session.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(
    request('PANEL_BIND', { sourceTabId: 10, bound: false }),
    /Storage unavailable/
  );
  assert.equal((await request('PANEL_READY')).tabId, 10);
  chrome.storage.session.set = set;
  await assert.rejects(request('PANEL_BIND', { sourceTabId: 20, bound: true }), {
    code: 'errorCurrentPage'
  });
  await assert.rejects(
    settingsRequest('PANEL_BIND', { windowId: 1, sourceTabId: 10, bound: false }),
    { code: 'errorPanelOnly' }
  );
});

test('moving a bound tab transfers its saved page without binding other destination tabs', async context => {
  const { chrome, request, sender } = await background(context);
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:1',
    sender,
    onDisconnect: event(),
    postMessage: m => messages.push(m)
  });
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  chrome.tabs.onDetached.emit(10, { oldWindowId: 1 });
  chrome.tabs.onAttached.emit(10, { newWindowId: 2 });
  chrome.tabs.get = async id => ({ id, windowId: 2 });
  chrome.tabs.query = async () => [{ id: 10, windowId: 2 }];
  assert.equal((await request('PANEL_READY', {}, 2)).tabId, 10);
  assert.equal(chrome.storage.session.values[BINDINGS_KEY][10].windowId, 2);
  assert(messages.some(m => m.type === 'remove-tab' && m.tabId === 10));
  chrome.tabs.query = async () => [{ id: 20, windowId: 2 }];
  assert.equal((await request('PANEL_READY', {}, 2)).tabId, null);
});

test('binding transfers and clears shared history without affecting other windows, and rolls back failed writes', async context => {
  const { chrome, request } = await background(context);
  await request('PANEL_NAVIGATE', { input: b }, 2);
  await request('PANEL_NAVIGATE', { input: a });
  await request('PANEL_NAVIGATE', { input: internal });
  const before = await request('PANEL_READY');
  const originalLocal = structuredClone(chrome.storage.local.values[LAST_KEY]);
  const setSession = chrome.storage.session.set;
  const setLocal = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Local failed');
  };
  await assert.rejects(request('PANEL_BIND', { sourceTabId: 10, bound: true }), /Local failed/);
  assert.deepEqual(await request('PANEL_READY'), before);
  assert.equal(chrome.storage.session.values[BINDINGS_KEY]?.[10], undefined);
  chrome.storage.local.set = setLocal;
  chrome.storage.session.set = async () => {
    throw new Error('Session failed');
  };
  await assert.rejects(request('PANEL_BIND', { sourceTabId: 10, bound: true }), /Session failed/);
  assert.deepEqual(await request('PANEL_READY'), before);
  assert.deepEqual(chrome.storage.local.values[LAST_KEY], originalLocal);
  chrome.storage.session.set = setSession;
  const bound = await request('PANEL_BIND', { sourceTabId: 10, bound: true });
  assert.deepEqual(bound.history, [a, internal]);
  assert.equal(bound.url, internal);
  const empty = { url: '', mode: 'desktop', history: [], historyIndex: -1 };
  assert.deepEqual(chrome.storage.session.values[WINDOWS_KEY][1], empty);
  assert.deepEqual(chrome.storage.local.values[LAST_KEY], empty);
  assert.equal((await request('PANEL_READY', {}, 2)).url, b);
  const unbound = await request('PANEL_BIND', { sourceTabId: 10, bound: false });
  assert.equal(unbound.url, '');
  assert.deepEqual(unbound.history, []);
});

test('search engine preference persists, broadcasts without navigation, and controls keyword navigation', async context => {
  const key = 'pocket-search-engine-v1';
  const { chrome, request, settingsRequest, sender } = await background(context, { [key]: 'bing' });
  assert.equal((await settingsRequest('SETTINGS_GET')).searchEngine, 'bing');
  const before = await request('PANEL_NAVIGATE', { input: a });
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:1',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(message)
  });
  await settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: 'baidu' });
  const after = await request('PANEL_READY');
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.equal(after.searchEngine, 'baidu');
  assert.equal((await request('PANEL_READY', {}, 2)).searchEngine, 'baidu');
  assert.equal(chrome.storage.local.values[key], 'baidu');
  assert(
    messages.some(message => message.type === 'search-engine' && message.searchEngine === 'baidu')
  );
  const searched = await request('PANEL_NAVIGATE', { input: '搜索 & words' });
  assert.equal(searched.url, 'https://www.baidu.com/s?wd=' + encodeURIComponent('搜索 & words'));
  assert.equal(searched.recentUrls[0], searched.url);
  await request('PANEL_SAVE', { state: before });
  assert.equal((await settingsRequest('SETTINGS_GET')).searchEngine, 'baidu');
  await assert.rejects(
    settingsRequest(
      'SETTINGS_SEARCH_ENGINE',
      { searchEngine: 'bing' },
      { id: 'test', url: 'https://example.com/' }
    ),
    { code: 'errorSettingsOnly' }
  );
  const originalSet = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(
    settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: 'duckduckgo' }),
    /Storage unavailable/
  );
  assert.equal((await settingsRequest('SETTINGS_GET')).searchEngine, 'baidu');
  chrome.storage.local.set = originalSet;
  await settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: 'duckduckgo' });
  assert.equal(
    (await request('PANEL_NAVIGATE', { input: 'words' })).url,
    'https://duckduckgo.com/?q=words'
  );
});

test('invalid stored search engines fall back to Google', async context => {
  const { settingsRequest } = await background(context, { 'pocket-search-engine-v1': 'unknown' });
  assert.equal((await settingsRequest('SETTINGS_GET')).searchEngine, 'google');
});

test('custom engine saves atomically, broadcasts to windows, survives stale saves and restores after restart', async context => {
  const { chrome, request, settingsRequest, sender } = await background(context);
  const before = await request('PANEL_NAVIGATE', { input: a });
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  const custom = { name: 'My search', url: 'https://example.com/search?q=%s&lang=ja' };
  const saved = await settingsRequest('SETTINGS_CUSTOM_SEARCH_ENGINE', {
    customSearchEngine: custom
  });
  assert.equal(saved.searchEngine, 'custom');
  assert.deepEqual(saved.customSearchEngine, custom);
  const after = await request('PANEL_READY');
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.recentUrls, before.recentUrls);
  assert.deepEqual((await request('PANEL_READY', {}, 2)).customSearchEngine, custom);
  assert(
    messages.some(
      message =>
        message.type === 'search-engine' &&
        message.searchEngine === 'custom' &&
        message.customSearchEngine.name === 'My search'
    )
  );
  assert.equal(chrome.storage.local.values[SEARCH_ENGINE_KEY], 'custom');
  assert.deepEqual(chrome.storage.local.values[CUSTOM_SEARCH_ENGINE_KEY], custom);
  await request('PANEL_SAVE', { state: before });
  assert.deepEqual((await settingsRequest('SETTINGS_GET')).customSearchEngine, custom);
  assert.equal((await settingsRequest('SETTINGS_GET')).searchEngine, 'custom');
  const query = '日本語 & cats #';
  const expected = 'https://example.com/search?q=' + encodeURIComponent(query) + '&lang=ja';
  assert.equal((await request('PANEL_NAVIGATE', { input: query })).url, expected);
  await settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: 'yahoo-japan' });
  assert.equal(
    (await request('PANEL_NAVIGATE', { input: query })).url,
    'https://search.yahoo.co.jp/search?p=' + encodeURIComponent(query)
  );
  assert.deepEqual((await settingsRequest('SETTINGS_GET')).customSearchEngine, custom);
  await settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: 'custom' });
  const restarted = await background(context, chrome.storage.local.values);
  assert.deepEqual((await restarted.settingsRequest('SETTINGS_GET')).customSearchEngine, custom);
  assert.equal((await restarted.request('PANEL_NAVIGATE', { input: query })).url, expected);
});

test('invalid or failed custom engine changes leave the selected engine and saved template intact', async context => {
  const custom = { name: 'Saved', url: 'https://example.com/?q=%s' };
  const { chrome, request, settingsRequest, sender } = await background(context, {
    [SEARCH_ENGINE_KEY]: 'custom',
    [CUSTOM_SEARCH_ENGINE_KEY]: custom
  });
  const before = await request('PANEL_READY');
  const next = { name: 'New engine', url: 'https://new.example/?q=%s' };
  await assert.rejects(
    settingsRequest(
      'SETTINGS_CUSTOM_SEARCH_ENGINE',
      { customSearchEngine: next },
      { id: 'test', url: 'https://example.com/' }
    ),
    { code: 'errorSettingsOnly' }
  );
  await assert.rejects(
    settingsRequest('SETTINGS_CUSTOM_SEARCH_ENGINE', {
      customSearchEngine: { name: 'Invalid', url: 'javascript:%s' }
    }),
    { code: 'errorCustomSearchUrl' }
  );
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:1',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(structuredClone(message))
  });
  messages.length = 0;
  const originalSet = chrome.storage.local.set;
  chrome.storage.local.set = async () => {
    throw new Error('Storage unavailable');
  };
  await assert.rejects(
    settingsRequest('SETTINGS_CUSTOM_SEARCH_ENGINE', { customSearchEngine: next }),
    /Storage unavailable/
  );
  assert.equal(messages.filter(message => message.type === 'search-engine').length, 0);
  assert.deepEqual(await request('PANEL_READY'), before);
  assert.deepEqual(chrome.storage.local.values[CUSTOM_SEARCH_ENGINE_KEY], custom);
  chrome.storage.local.set = originalSet;
  await settingsRequest('SETTINGS_CUSTOM_SEARCH_ENGINE', { customSearchEngine: next });
  assert.equal(
    (await request('PANEL_NAVIGATE', { input: 'words' })).url,
    'https://new.example/?q=words'
  );
});

test('corrupt custom configuration restores Google without blocking navigation or future settings', async context => {
  const { request, settingsRequest } = await background(context, {
    [SEARCH_ENGINE_KEY]: 'custom',
    [CUSTOM_SEARCH_ENGINE_KEY]: { name: 'Broken', url: 'https://%s.example/' }
  });
  const restored = await settingsRequest('SETTINGS_GET');
  assert.equal(restored.searchEngine, 'google');
  assert.equal(restored.customSearchEngine, null);
  assert.equal(
    (await request('PANEL_NAVIGATE', { input: 'words' })).url,
    'https://www.google.com/search?q=words'
  );
  await assert.rejects(settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: 'custom' }), {
    code: 'errorCustomSearchUrl'
  });
  await settingsRequest('SETTINGS_SEARCH_ENGINE', { searchEngine: 'yahoo-japan' });
  assert.equal((await settingsRequest('SETTINGS_GET')).searchEngine, 'yahoo-japan');
});

test('upgrades start at window width and navigation never persists the default layout', async context => {
  const { chrome, request } = await background(context, {
    [MODE_KEY]: undefined,
    'pocket-sidepanel-mode-v1': 'mobile',
    [LAST_KEY]: { url: a, mode: 'mobile', history: [a], historyIndex: 0 }
  });
  assert.equal((await request('PANEL_READY')).mode, 'desktop');
  await request('PANEL_NAVIGATE', { input: b });
  assert.equal((await request('PANEL_READY')).mode, 'desktop');
  assert.equal(chrome.storage.local.values[MODE_KEY], undefined);
});

test('a saved narrow default keeps native identity; per-site choices survive stale saves and default changes', async context => {
  const { chrome, request, settingsRequest, sender } = await background(context, {
    [MODE_KEY]: 'mobile'
  });
  assert.equal(chrome.scripting.registered.length, 0);
  assert.equal(chrome.declarativeNetRequest.rules.length, 3);
  const original = await request('PANEL_NAVIGATE', { input: a });
  assert.equal(original.requestMobile, false);
  await request('PANEL_NAVIGATE', { input: b }, 2);
  const messages = [];
  chrome.runtime.onConnect.emit({
    name: 'pocket-sidepanel:2',
    sender,
    onDisconnect: event(),
    postMessage: message => messages.push(message)
  });
  const preference = { mode: 'mobile', requestMobile: true };
  await request('PANEL_SITE_PREFERENCE', { url: a, preference });
  assert.equal((await request('PANEL_READY')).requestMobile, true);
  assert.equal((await request('PANEL_READY', {}, 2)).requestMobile, false);
  assert(
    messages.some(
      message =>
        message.type === 'preferences' && message.sitePreferences['a.example']?.requestMobile
    )
  );
  assert.deepEqual(chrome.scripting.registered[0].matches, ['*://a.example/*']);
  assert.equal(chrome.declarativeNetRequest.rules.length, 5);
  await settingsRequest('SETTINGS_MODE', { mode: 'desktop' });
  await request('PANEL_SAVE', { state: original });
  assert.equal((await request('PANEL_READY')).mode, 'mobile');
  assert.equal((await request('PANEL_READY')).requestMobile, true);
  assert.equal((await request('PANEL_READY', {}, 2)).mode, 'desktop');
  assert.deepEqual(chrome.storage.local.values[SITE_PREFERENCES_KEY], { 'a.example': preference });
  // An internal redirect to a different hostname returns to its own preference.
  await request('PANEL_SAVE', { state: { ...original, url: b } });
  assert.equal((await request('PANEL_READY')).requestMobile, false);
  await request('PANEL_NAVIGATE', { input: internal });
  assert.equal((await request('PANEL_READY')).requestMobile, true);
  await settingsRequest('SETTINGS_RESET_SITE', { hostname: 'a.example' });
  assert.equal((await request('PANEL_READY')).mode, 'desktop');
  assert.equal((await request('PANEL_READY')).requestMobile, false);
  assert.equal(chrome.scripting.registered.length, 0);
  assert.equal(chrome.declarativeNetRequest.rules.length, 3);
});

test('site preferences restore before navigation and reject stale or unauthorized changes', async context => {
  const preference = { mode: 'mobile', requestMobile: true };
  const { request, settingsRequest, chrome } = await background(context, {
    [SITE_PREFERENCES_KEY]: { 'a.example': preference }
  });
  assert.equal(chrome.declarativeNetRequest.rules.length, 5);
  await request('PANEL_NAVIGATE', { input: a });
  await assert.rejects(request('PANEL_SITE_PREFERENCE', { url: b, preference }), {
    code: 'errorCurrentPage'
  });
  await assert.rejects(
    request('PANEL_SITE_PREFERENCE', { url: a, preference: { mode: 'mobile' } }),
    { code: 'errorUnknownOperation' }
  );
  await assert.rejects(
    settingsRequest('PANEL_SITE_PREFERENCE', { windowId: 1, url: a, preference }),
    { code: 'errorPanelOnly' }
  );
  await assert.rejects(
    settingsRequest(
      'SETTINGS_RESET_SITE',
      { hostname: 'a.example' },
      { id: 'test', url: 'https://a.example/' }
    ),
    { code: 'errorSettingsOnly' }
  );
  await request('PANEL_SITE_PREFERENCE', { url: a, preference: null });
  assert.equal((await request('PANEL_READY')).requestMobile, false);
});

test('site rule and storage failures roll back rules and scripts and remain retryable', async context => {
  const { request, chrome } = await background(context);
  await request('PANEL_NAVIGATE', { input: a });
  const preference = { mode: 'mobile', requestMobile: true };
  const originalUpdate = chrome.declarativeNetRequest.updateSessionRules;
  const originalWrite = chrome.storage.local.set;
  for (const target of ['rules', 'storage']) {
    let fail = true;
    if (target === 'rules')
      chrome.declarativeNetRequest.updateSessionRules = async function (args) {
        if (fail) {
          fail = false;
          throw new Error('Unavailable');
        }
        return originalUpdate.call(this, args);
      };
    else
      chrome.storage.local.set = async function (args) {
        if (fail) {
          fail = false;
          throw new Error('Unavailable');
        }
        return originalWrite.call(this, args);
      };
    await assert.rejects(request('PANEL_SITE_PREFERENCE', { url: a, preference }), /Unavailable/);
    assert.equal((await request('PANEL_READY')).requestMobile, false);
    assert.equal(chrome.declarativeNetRequest.rules.length, 3);
    assert.equal(chrome.scripting.registered.length, 0);
    chrome.declarativeNetRequest.updateSessionRules = originalUpdate;
    chrome.storage.local.set = originalWrite;
  }
  await request('PANEL_SITE_PREFERENCE', { url: a, preference });
  assert.equal((await request('PANEL_READY')).requestMobile, true);
});
