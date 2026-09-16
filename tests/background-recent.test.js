import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_KEY, RECENT_TITLES_KEY } from '../recent-urls.js';
import { LAST_KEY, MODE_KEY, navigatePanel, commitPanelNavigation } from '../sidepanel-state.js';

const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); }, emit(...args) { for (const fn of this.listeners) fn(...args); } });
const area = values => ({
  values: structuredClone(values),
  async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(this.values[key])])); },
  async set(values) { Object.assign(this.values, structuredClone(values)); }
});
const a = 'https://a.example/', b = 'https://b.example/', internal = 'https://a.example/internal';
let generation = 0;
async function background(context, localValues = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  context.after(() => { if (previous) Object.defineProperty(globalThis, 'chrome', previous); else delete globalThis.chrome; });
  const shell = 'chrome-extension://test/sidepanel.html';
  const sender = { id: 'test', url: shell, documentId: 'panel-document' };
  const chrome = globalThis.chrome = {
    storage: { local: area({ [MODE_KEY]: 'desktop', ...localValues }), session: area({}) },
    runtime: { id: 'test', getURL: path => `chrome-extension://test/${path}`, getContexts: async () => [{}],
      onMessage: event(), onConnect: event(), onStartup: event(), onInstalled: event() },
    scripting: { getRegisteredContentScripts: async () => [] },
    declarativeNetRequest: { updateSessionRules: async () => {} },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    windows: { get: async () => ({ type: 'normal' }), onRemoved: event() },
    tabs: { query: async () => [{ url: a }], create: async () => {} },
    contextMenus: { onClicked: event() }, commands: { onCommand: event() }
  };
  await import(`../background.js?recent-test=${++generation}`);
  const request = (type, data = {}, windowId = 1) => new Promise((resolve, reject) => {
    chrome.runtime.onMessage.listeners[0]({ type, windowId, ...data }, sender, response => {
      if (response.ok) resolve(response.data); else reject(Object.assign(new Error(response.error), { code: response.errorCode }));
    });
  });
  await request('PANEL_READY');
  return { chrome, request, sender };
}

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
  chrome.contextMenus.onClicked.emit({ menuItemId: 'open-pocket', linkUrl: internal }, { windowId: 1 });
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [internal, a, b]);
  chrome.commands.onCommand.emit('open-current', { windowId: 1, url: b });
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [b, internal, a]);
  const state = await request('PANEL_NAVIGATE', { input: 'some search' });
  assert.equal(state.recentUrls[0], 'https://www.google.com/search?q=some%20search');
  await assert.rejects(request('PANEL_NAVIGATE', { input: 'javascript:alert(1)' }), { code: 'errorUnsupportedScheme' });
  assert.deepEqual((await request('PANEL_READY')).recentUrls, state.recentUrls);
});

test('recent addresses are shared and broadcast while window navigation stays independent', async context => {
  const { request, chrome, sender } = await background(context);
  await request('PANEL_READY', {}, 2);
  const messages = [];
  chrome.runtime.onConnect.emit({ name: 'pocket-sidepanel:2', sender, onDisconnect: event(), postMessage: message => messages.push(structuredClone(message)) });
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
  const { request, chrome } = await background(context, { [RECENT_KEY]: [a, b], [LAST_KEY]: { url: a, history: [a] } });
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
  const { request, chrome, sender } = await background(context, { [RECENT_KEY]: [a, internal, b], [LAST_KEY]: { url: a, history: [a, internal], historyIndex: 0 } });
  const before = await request('PANEL_READY');
  const messages = [];
  chrome.runtime.onConnect.emit({ name: 'pocket-sidepanel:2', sender, onDisconnect: event(), postMessage: message => messages.push(structuredClone(message)) });
  assert.deepEqual(await request('PANEL_REMOVE_RECENT', { url: a }), [internal, b]);
  const after = await request('PANEL_SAVE', { state: before });
  assert.equal(after.url, before.url);
  assert.deepEqual(after.history, before.history);
  assert.equal(after.historyIndex, before.historyIndex);
  assert.deepEqual(after.recentUrls, [internal, b]);
  assert.deepEqual(chrome.storage.local.values[RECENT_KEY], [internal, b]);
  assert.deepEqual((await request('PANEL_READY', {}, 2)).recentUrls, [internal, b]);
  assert(messages.some(message => message.type === 'recent' && JSON.stringify(message.urls) === JSON.stringify([internal, b])));
  assert(!messages.some(message => message.type === 'navigate'));
});

test('removing the final entry is idempotent and queued explicit opens can add it again', async context => {
  const { request, chrome } = await background(context, { [RECENT_KEY]: [a], [LAST_KEY]: { url: a } });
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
  chrome.contextMenus.onClicked.emit({ menuItemId: 'open-pocket', linkUrl: internal }, { windowId: 1, url: a, title: 'Wrong source title' });
  assert.equal((await request('PANEL_READY')).recentTitles[internal], undefined);
  chrome.commands.onCommand.emit('open-current', { windowId: 1, url: b, title: 'Second page' });
  assert.equal((await request('PANEL_READY')).recentTitles[b], 'Second page');
  await request('PANEL_NAVIGATE', { input: a });
  assert.equal((await request('PANEL_READY')).recentTitles[a], 'Home page');
});

test('loaded titles persist and broadcast without adding or reordering entries', async context => {
  const { request, chrome, sender } = await background(context, { [RECENT_KEY]: [a, b] });
  const messages = [];
  chrome.runtime.onConnect.emit({ name: 'pocket-sidepanel:2', sender, onDisconnect: event(), postMessage: message => messages.push(structuredClone(message)) });
  const state = await request('PANEL_READY');
  commitPanelNavigation(state, internal);
  await request('PANEL_SAVE', { state });
  // A loaded redirect can supply the title for its existing explicit destination.
  assert.deepEqual(await request('PANEL_RECENT_TITLE', { url: a, pageUrl: internal, title: ' Loaded\n title ' }), { [a]: 'Loaded title' });
  assert.deepEqual((await request('PANEL_READY')).recentUrls, [a, b]);
  assert.deepEqual(chrome.storage.local.values[RECENT_TITLES_KEY], { [a]: 'Loaded title' });
  assert(messages.some(message => message.type === 'recent' && message.titles[a] === 'Loaded title'));
  assert(!messages.some(message => message.type === 'navigate'));
  await request('PANEL_RECENT_TITLE', { url: internal, pageUrl: internal, title: 'Unrecorded internal page' });
  await request('PANEL_RECENT_TITLE', { url: b, pageUrl: b, title: 'Stale page' });
  assert.deepEqual((await request('PANEL_READY')).recentTitles, { [a]: 'Loaded title' });
});

test('stored titles survive restoration and late metadata cannot restore removed entries', async context => {
  const { request, chrome } = await background(context, { [RECENT_KEY]: [a, b], [RECENT_TITLES_KEY]: { [a]: 'Home', [b]: 'Second', [internal]: 'Orphan' }, [LAST_KEY]: { url: a } });
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
