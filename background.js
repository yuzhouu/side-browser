import { parseInput, validMode, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { LAST_KEY, WINDOWS_KEY, MODE_KEY, restorePanel, navigatePanel } from './sidepanel-state.js';
import { RECENT_KEY, RECENT_TITLES_KEY, restoreRecentUrls, rememberRecentUrl, restoreRecentTitles, normalizeRecentTitle } from './recent-urls.js';
import { PANEL_RULE_IDS, panelRules } from './network-rules.js';
import { t } from './i18n.js';
import { userError } from './errors.js';

const SHELL = chrome.runtime.getURL('sidepanel.html');
const MOBILE_SCRIPTS = ['pocket-mobile-gate', 'pocket-mobile-main'];
let windows = {}, last, mode, recentUrls = [], recentTitles = {}, queue = Promise.resolve();
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
    chrome.storage.local.get([LAST_KEY, MODE_KEY, RECENT_KEY, RECENT_TITLES_KEY, 'pocket-global-overlay-v1']),
    chrome.storage.session.get(WINDOWS_KEY)
  ]);
  last = restorePanel(local[LAST_KEY] || local['pocket-global-overlay-v1']);
  mode = validMode(local[MODE_KEY] ?? last.mode);
  recentUrls = restoreRecentUrls(local[RECENT_KEY]);
  recentTitles = restoreRecentTitles(local[RECENT_TITLES_KEY], recentUrls);
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
  return { ...structuredClone(windows[windowId]), mode, recentUrls: [...recentUrls], recentTitles: { ...recentTitles } };
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
    throw userError('errorPanelOnly');
  const contexts = await chrome.runtime.getContexts({ ...(sender.documentId ? { documentIds: [sender.documentId] } : { documentUrls: [SHELL] }), contextTypes: ['SIDE_PANEL'] });
  if (!contexts.length || (await chrome.windows.get(windowId)).type !== 'normal') throw userError('errorWindowClosed');
}
function publish(windowId, message) {
  try { ports.get(windowId)?.postMessage(message); } catch { ports.delete(windowId); }
}
async function saveRecent(urls, titles = recentTitles) {
  titles = restoreRecentTitles(titles, urls);
  await chrome.storage.local.set({ [RECENT_KEY]: urls, [RECENT_TITLES_KEY]: titles });
  recentUrls = urls; recentTitles = titles;
  for (const id of ports.keys()) publish(id, { type: 'recent', urls: [...recentUrls], titles: { ...recentTitles } });
  return [...recentUrls];
}
async function navigate(windowId, input, sourceTitle) {
  const state = getState(windowId), url = frameDestination(input, parseInput);
  const title = normalizeRecentTitle(sourceTitle);
  await saveRecent(rememberRecentUrl(recentUrls, url), title ? { ...recentTitles, [url]: title } : recentTitles);
  if (url === state.url) return getState(windowId);
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
      case 'PANEL_NAVIGATE': return navigate(message.windowId, message.input);
      case 'PANEL_CLEAR_RECENT': return saveRecent([]);
      case 'PANEL_REMOVE_RECENT': return saveRecent(recentUrls.filter(url => url !== message.url));
      case 'PANEL_RECENT_TITLE': {
        const title = normalizeRecentTitle(message.title);
        if (title && recentUrls.includes(message.url) && getState(message.windowId).url === message.pageUrl && recentTitles[message.url] !== title)
          await saveRecent(recentUrls, { ...recentTitles, [message.url]: title });
        return { ...recentTitles };
      }
      case 'PANEL_MODE':
        mode = validMode(message.mode); await rules();
        await chrome.storage.local.set({ [MODE_KEY]: mode });
        // UA is one extension-wide preference; every window keeps its own URL/history.
        for (const id of ports.keys()) publish(id, { type: 'mode', mode });
        return mode;
      case 'PANEL_CURRENT': {
        const tab = (await chrome.tabs.query({ active: true, windowId: message.windowId }))[0];
        if (!isWebUrl(tab?.url)) throw userError('errorCurrentPage');
        return navigate(message.windowId, tab.url, tab.title);
      }
      case 'PANEL_EXTERNAL': {
        const url = getState(message.windowId).url;
        if (isWebUrl(url)) await chrome.tabs.create({ windowId: message.windowId, url, active: true });
        return true;
      }
      default: throw userError('errorUnknownOperation');
    }
  }).then(data => reply({ ok: true, data }), error => reply({ ok: false, error: error.message, errorCode: error.code }));
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
chrome.runtime.onStartup.addListener(() => {
  // Context menus persist across restarts, including a change of Chrome UI language.
  void update(() => chrome.contextMenus.update('open-pocket', { title: t('contextOpen') })).catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => {
  void update(async () => {
    // Remove the known old page overlay; ordinary page contents remain untouched.
    const key = 'pocket-page-mount-v1', previous = (await chrome.storage.session.get(key))[key];
    if (previous?.tabId) await chrome.tabs.sendMessage(previous.tabId, { type: 'POCKET_REMOVE', id: previous.id }, { frameId: 0 }).catch(() => {});
    await chrome.storage.session.remove(key);
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: 'open-pocket', title: t('contextOpen'), contexts: ['page', 'link', 'action'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  }).catch(() => {});
});
function openFromGesture(windowId, input, title) {
  // Call open before any await so Chrome retains the user's gesture.
  const opened = chrome.sidePanel.open({ windowId });
  void update(() => navigate(windowId, input, title)).catch(() => {});
  void opened.catch(() => {});
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-pocket' && tab?.windowId)
    openFromGesture(tab.windowId, info.linkUrl || tab.url, !info.linkUrl || info.linkUrl === tab.url ? tab.title : undefined);
});
chrome.commands.onCommand.addListener((name, tab) => {
  if (name === 'open-current' && isWebUrl(tab?.url)) openFromGesture(tab.windowId, tab.url, tab.title);
});
