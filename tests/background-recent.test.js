import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_KEY } from '../recent-urls.js';
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
