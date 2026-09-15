import { parseInput, validMode, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { LAST_KEY, WINDOWS_KEY, MODE_KEY, restorePanel, navigatePanel } from './sidepanel-state.js';
import { PANEL_RULE_IDS, panelRules } from './network-rules.js';

const SHELL = chrome.runtime.getURL('sidepanel.html');
const MOBILE_SCRIPTS = ['pocket-mobile-gate', 'pocket-mobile-main'];
let windows = {}, last, mode, queue = Promise.resolve();
const ports = new Map();
async function rules() {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: MOBILE_SCRIPTS });
  if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: registered.map(s => s.id) });
  if (mode === 'mobile') {
    const common = { matches: ['http://*/*', 'https://*/*'], allFrames: true, runAt: 'document_start' };
    await chrome.scripting.registerContentScripts([
      { ...common, id: MOBILE_SCRIPTS[0], world: 'ISOLATED', js: ['mobile-profile.js', 'mobile-identity-gate.js'] },
      { ...common, id: MOBILE_SCRIPTS[1], world: 'MAIN', js: ['mobile-identity-main.js'] }
    ]);
  }
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: PANEL_RULE_IDS,
    addRules: panelRules(chrome.runtime.id, mode, navigator.userAgent) });
}
const ready = (async () => {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([LAST_KEY, MODE_KEY, 'pocket-global-overlay-v1']),
    chrome.storage.session.get(WINDOWS_KEY)
  ]);
  last = restorePanel(local[LAST_KEY] || local['pocket-global-overlay-v1']);
  mode = validMode(local[MODE_KEY] ?? last.mode);
  for (const [id, saved] of Object.entries(session[WINDOWS_KEY] || {})) windows[id] = restorePanel(saved);
  await rules();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
})();
function update(task) {
  const result = queue.then(() => ready).then(task);
  queue = result.catch(() => {}); return result;
}
function getState(windowId) {
  windows[windowId] ||= restorePanel(last);
  return { ...structuredClone(windows[windowId]), mode };
}
async function save(windowId, value) {
  windows[windowId] = restorePanel({ ...value, mode }); last = windows[windowId];
  await Promise.all([
    chrome.storage.session.set({ [WINDOWS_KEY]: windows }),
    chrome.storage.local.set({ [LAST_KEY]: last, [MODE_KEY]: mode })
  ]);
  return getState(windowId);
}
async function verify(sender, windowId) {
  if (sender.id !== chrome.runtime.id || sender.url !== SHELL || sender.tab || !Number.isInteger(windowId))
    throw new Error('操作仅限伴页侧边栏。');
  const contexts = await chrome.runtime.getContexts({ ...(sender.documentId ? { documentIds: [sender.documentId] } : { documentUrls: [SHELL] }), contextTypes: ['SIDE_PANEL'] });
  if (!contexts.length || (await chrome.windows.get(windowId)).type !== 'normal') throw new Error('侧边栏窗口已关闭。');
}
function publish(windowId, message) {
  try { ports.get(windowId)?.postMessage(message); } catch { ports.delete(windowId); }
}
async function navigate(windowId, input) {
  const state = getState(windowId), url = frameDestination(input, parseInput);
  if (url === state.url) return state;
  navigatePanel(state, url); await save(windowId, state);
  publish(windowId, { type: 'navigate', state: getState(windowId) });
  return getState(windowId);
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message.type?.startsWith('PANEL_')) return false;
  update(async () => {
    await verify(sender, message.windowId);
    switch (message.type) {
      case 'PANEL_READY': return getState(message.windowId);
      case 'PANEL_SAVE': return save(message.windowId, message.state);
      case 'PANEL_MODE':
        mode = validMode(message.mode); await rules();
        await chrome.storage.local.set({ [MODE_KEY]: mode });
        // UA is one extension-wide preference; every window keeps its own URL/history.
        for (const id of ports.keys()) publish(id, { type: 'mode', mode });
        return mode;
      case 'PANEL_CURRENT': {
        const tab = (await chrome.tabs.query({ active: true, windowId: message.windowId }))[0];
        if (!isWebUrl(tab?.url)) throw new Error('当前页面没有可打开的 HTTP 或 HTTPS 网址。');
        return navigate(message.windowId, tab.url);
      }
      case 'PANEL_EXTERNAL': {
        const url = getState(message.windowId).url;
        if (isWebUrl(url)) await chrome.tabs.create({ windowId: message.windowId, url, active: true });
        return true;
      }
      default: throw new Error('未知侧边栏操作。');
    }
  }).then(data => reply({ ok: true, data }), error => reply({ ok: false, error: error.message }));
  return true;
});
chrome.runtime.onConnect.addListener(port => {
  if (!port.name.startsWith('pocket-sidepanel:')) return;
  const id = Number(port.name.slice('pocket-sidepanel:'.length));
  void update(async () => {
    await verify(port.sender, id); ports.set(id, port);
    port.onDisconnect.addListener(() => { if (ports.get(id) === port) ports.delete(id); });
    port.postMessage({ type: 'connected', state: getState(id) });
  }).catch(() => port.disconnect());
});
chrome.windows.onRemoved.addListener(id => {
  void update(async () => { delete windows[id]; ports.delete(id); await chrome.storage.session.set({ [WINDOWS_KEY]: windows }); }).catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => {
  void update(async () => {
    // Remove the known old page overlay; ordinary page contents remain untouched.
    const key = 'pocket-page-mount-v1', previous = (await chrome.storage.session.get(key))[key];
    if (previous?.tabId) await chrome.tabs.sendMessage(previous.tabId, { type: 'POCKET_REMOVE', id: previous.id }, { frameId: 0 }).catch(() => {});
    await chrome.storage.session.remove(key);
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: 'open-pocket', title: '在伴页中打开', contexts: ['page', 'link'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  }).catch(() => {});
});
function openFromGesture(windowId, input) {
  // Call open before any await so Chrome retains the user's gesture.
  const opened = chrome.sidePanel.open({ windowId });
  void update(() => navigate(windowId, input)).catch(() => {});
  void opened.catch(() => {});
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-pocket' && tab?.windowId) openFromGesture(tab.windowId, info.linkUrl || tab.url);
});
chrome.commands.onCommand.addListener((name, tab) => {
  if (name === 'open-current' && isWebUrl(tab?.url)) openFromGesture(tab.windowId, tab.url);
});
