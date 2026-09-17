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
async function background(context, localValues = {}, sessionValues = {}) {
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
      getRegisteredContentScripts: async () => [],
      registerContentScripts: async () => {}
    },
    declarativeNetRequest: { updateSessionRules: async () => {} },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    windows: { get: async () => ({ type: 'normal' }), onRemoved: event() },
    tabs: {
      query: async ({ windowId } = {}) => [
        { id: windowId === 2 ? 20 : 10, windowId: windowId || 1, url: a }
      ],
      get: async id => ({ id, windowId: id >= 20 ? 2 : 1, url: a }),
      create: async () => {},
      onActivated: event(),
      onRemoved: event(),
      onDetached: event(),
      onAttached: event()
    },
    contextMenus: {
      onClicked: event(),
      removeAll: async () => {},
      create: (_options, callback) => callback()
    },
    i18n: { getMessage: key => key },
    commands: { onCommand: event() }
  });
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
    mode: 'desktop',
    theme: 'system',
    recentCount: 2
  });
  assert.deepEqual(await settingsRequest('SETTINGS_MODE', { mode: 'mobile' }), {
    mode: 'mobile',
    theme: 'system',
    recentCount: 2
  });
  assert.equal(chrome.storage.local.values[MODE_KEY], 'mobile');
  assert(messages.some(message => message.type === 'mode' && message.mode === 'mobile'));
  assert.deepEqual(await settingsRequest('SETTINGS_CLEAR_RECENT'), {
    mode: 'mobile',
    theme: 'system',
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

test('a failed settings mode change preserves the preference and can be retried', async context => {
  const { chrome, settingsRequest } = await background(context);
  const original = chrome.declarativeNetRequest.updateSessionRules;
  let fail = true;
  chrome.declarativeNetRequest.updateSessionRules = async () => {
    if (fail) {
      fail = false;
      throw new Error('Rules unavailable');
    }
  };
  await assert.rejects(settingsRequest('SETTINGS_MODE', { mode: 'mobile' }), /Rules unavailable/);
  assert.equal((await settingsRequest('SETTINGS_GET')).mode, 'desktop');
  assert.equal(chrome.storage.local.values[MODE_KEY], 'desktop');
  chrome.declarativeNetRequest.updateSessionRules = original;
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

test('clearing stays persisted after stale saves, reloads, external opens and reopening the same URL', async context => {
  const { request, chrome } = await background(context, {
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
  assert.deepEqual(logs, []);
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
