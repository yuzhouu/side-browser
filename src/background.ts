import type {
  Mode,
  Theme,
  PanelState,
  PanelSnapshot,
  Settings,
  PanelRequest,
  SettingsRequest,
  BackgroundMessage
} from './types.js';
import { parseInput, validMode, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { LAST_KEY, WINDOWS_KEY, MODE_KEY, restorePanel, navigatePanel } from './sidepanel-state.js';
import {
  RECENT_KEY,
  RECENT_TITLES_KEY,
  restoreRecentUrls,
  rememberRecentUrl,
  restoreRecentTitles,
  normalizeRecentTitle
} from './recent-urls.js';
import { PANEL_RULE_IDS, panelRules } from './network-rules.js';
import { t } from './i18n.js';
import { userError } from './errors.js';
import { THEME_KEY, validTheme } from './theme-preference.js';

function isSettingsRequest(message: PanelRequest | SettingsRequest): message is SettingsRequest {
  return message.type.startsWith('SETTINGS_');
}

const SHELL = chrome.runtime.getURL('sidepanel.html');
const OPTIONS = chrome.runtime.getURL('options.html');
const MOBILE_SCRIPTS = ['pocket-mobile-gate', 'pocket-mobile-main'];
const windows: Record<string, PanelState> = {};
let last: PanelState;
let mode: Mode;
let theme: Theme;
let recentUrls: string[] = [];
let recentTitles: Record<string, string> = {};
let queue: Promise<unknown> = Promise.resolve();
const ports = new Map<number, chrome.runtime.Port>();

function reportFailure(operation: string, error: unknown) {
  console.error(`[SideBrowser] ${operation}`, error);
}

async function rules(selectedMode = mode) {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: MOBILE_SCRIPTS });
  if (registered.length)
    await chrome.scripting.unregisterContentScripts({ ids: registered.map(s => s.id) });
  if (selectedMode === 'mobile') {
    const common = {
      matches: ['http://*/*', 'https://*/*'],
      allFrames: true,
      runAt: 'document_start' as const
    };
    await chrome.scripting.registerContentScripts([
      {
        ...common,
        id: MOBILE_SCRIPTS[0],
        world: 'ISOLATED',
        js: ['mobile-identity-gate.js']
      },
      { ...common, id: MOBILE_SCRIPTS[1], world: 'MAIN', js: ['mobile-identity-main.js'] }
    ]);
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: PANEL_RULE_IDS,
    addRules: panelRules(chrome.runtime.id, selectedMode, navigator.userAgent)
  });
}

const ready = (async () => {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([
      LAST_KEY,
      MODE_KEY,
      THEME_KEY,
      RECENT_KEY,
      RECENT_TITLES_KEY,
      'pocket-global-overlay-v1'
    ]),
    chrome.storage.session.get(WINDOWS_KEY)
  ]);
  last = restorePanel(local[LAST_KEY] || local['pocket-global-overlay-v1']);
  mode = validMode(local[MODE_KEY] ?? last.mode);
  theme = validTheme(local[THEME_KEY]);
  recentUrls = restoreRecentUrls(local[RECENT_KEY]);
  recentTitles = restoreRecentTitles(local[RECENT_TITLES_KEY], recentUrls);
  for (const [id, saved] of Object.entries(session[WINDOWS_KEY] || {}))
    windows[id] = restorePanel(saved);
  await rules();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
})();
// Keep initialization failures observable even before the first panel connects.
void ready.catch(error => reportFailure('Initialize background', error));

function update<T>(task: () => T | PromiseLike<T>) {
  const result = queue.then(() => ready).then(task);
  // Recover the queue; the caller still receives and handles the original error.
  queue = result.catch(() => {});
  return result;
}

function getState(windowId: number): PanelSnapshot {
  windows[windowId] ||= restorePanel(last);
  return {
    ...structuredClone(windows[windowId]),
    mode,
    recentUrls: [...recentUrls],
    recentTitles: { ...recentTitles }
  };
}

async function save(windowId: number, value: PanelState) {
  windows[windowId] = restorePanel({ ...value, mode });
  last = windows[windowId];
  await Promise.all([
    chrome.storage.session.set({ [WINDOWS_KEY]: windows }),
    chrome.storage.local.set({ [LAST_KEY]: last, [MODE_KEY]: mode })
  ]);
  return getState(windowId);
}

async function verify(sender: chrome.runtime.MessageSender | undefined, windowId: number) {
  if (
    sender?.id !== chrome.runtime.id ||
    sender.url !== SHELL ||
    sender.tab ||
    !Number.isInteger(windowId)
  )
    throw userError('errorPanelOnly');
  const contexts = await chrome.runtime.getContexts({
    ...(sender.documentId ? { documentIds: [sender.documentId] } : { documentUrls: [SHELL] }),
    contextTypes: ['SIDE_PANEL']
  });
  if (!contexts.length || (await chrome.windows.get(windowId)).type !== 'normal')
    throw userError('errorWindowClosed');
}

function publish(windowId: number, message: BackgroundMessage) {
  // A panel can close between enumerating its port and sending the update.
  try {
    ports.get(windowId)?.postMessage(message);
  } catch {
    ports.delete(windowId);
  }
}

async function saveRecent(urls: string[], titles = recentTitles) {
  titles = restoreRecentTitles(titles, urls);
  await chrome.storage.local.set({ [RECENT_KEY]: urls, [RECENT_TITLES_KEY]: titles });
  recentUrls = urls;
  recentTitles = titles;
  for (const id of ports.keys())
    publish(id, { type: 'recent', urls: [...recentUrls], titles: { ...recentTitles } });
  return [...recentUrls];
}

async function navigate(windowId: number, input: unknown, sourceTitle?: string) {
  const state = getState(windowId);
  const url = frameDestination(input, parseInput);
  const title = normalizeRecentTitle(sourceTitle);
  await saveRecent(
    rememberRecentUrl(recentUrls, url),
    title ? { ...recentTitles, [url]: title } : recentTitles
  );
  if (url === state.url) return getState(windowId);
  navigatePanel(state, url);
  await save(windowId, state);
  publish(windowId, { type: 'navigate', state: getState(windowId) });
  return getState(windowId);
}

async function setMode(value: unknown) {
  const next = validMode(value);
  if (mode === next) return mode;
  try {
    await rules(next);
    await chrome.storage.local.set({ [MODE_KEY]: next });
  } catch (error) {
    await rules(mode).catch(restoreError => reportFailure('Restore display mode', restoreError));
    throw error;
  }
  mode = next;
  // UA is one extension-wide preference; every window keeps its own URL/history.
  for (const id of ports.keys()) publish(id, { type: 'mode', mode });
  return mode;
}

async function setTheme(value: unknown) {
  const next = validTheme(value);
  await chrome.storage.local.set({ [THEME_KEY]: next });
  theme = next;
  return theme;
}

function getSettings(): Settings {
  return { mode, theme, recentCount: recentUrls.length };
}

chrome.runtime.onMessage.addListener((message: PanelRequest | SettingsRequest, sender, reply) => {
  const settingsRequest = message.type?.startsWith('SETTINGS_');
  if (!settingsRequest && !message.type?.startsWith('PANEL_')) return false;
  update(async () => {
    if (isSettingsRequest(message)) {
      if (sender.id !== chrome.runtime.id || sender.url !== OPTIONS)
        throw userError('errorSettingsOnly');
      switch (message.type) {
        case 'SETTINGS_GET':
          return getSettings();
        case 'SETTINGS_MODE':
          await setMode(message.mode);
          return getSettings();
        case 'SETTINGS_THEME':
          await setTheme(message.theme);
          return getSettings();
        case 'SETTINGS_CLEAR_RECENT':
          await saveRecent([]);
          return getSettings();
        default:
          throw userError('errorUnknownOperation');
      }
    }
    await verify(sender, message.windowId);
    switch (message.type) {
      case 'PANEL_READY':
        return getState(message.windowId);
      case 'PANEL_SAVE':
        return save(message.windowId, message.state);
      case 'PANEL_NAVIGATE':
        return navigate(message.windowId, message.input);
      case 'PANEL_CLEAR_RECENT':
        return saveRecent([]);
      case 'PANEL_REMOVE_RECENT':
        return saveRecent(recentUrls.filter(url => url !== message.url));
      case 'PANEL_RECENT_TITLE': {
        const title = normalizeRecentTitle(message.title);
        if (
          title &&
          recentUrls.includes(message.url) &&
          getState(message.windowId).url === message.pageUrl &&
          recentTitles[message.url] !== title
        )
          await saveRecent(recentUrls, { ...recentTitles, [message.url]: title });
        return { ...recentTitles };
      }
      case 'PANEL_MODE':
        return setMode(message.mode);
      case 'PANEL_THEME':
        return setTheme(message.theme);
      case 'PANEL_CURRENT': {
        const tab = (await chrome.tabs.query({ active: true, windowId: message.windowId }))[0];
        if (!isWebUrl(tab?.url)) throw userError('errorCurrentPage');
        return navigate(message.windowId, tab.url, tab.title);
      }
      case 'PANEL_EXTERNAL': {
        const url = getState(message.windowId).url;
        if (isWebUrl(url))
          await chrome.tabs.create({ windowId: message.windowId, url, active: true });
        return true;
      }
      default:
        throw userError('errorUnknownOperation');
    }
  }).then(
    data => reply({ ok: true, data }),
    error => reply({ ok: false, error: error.message, errorCode: error.code })
  );
  return true;
});

chrome.runtime.onConnect.addListener(port => {
  if (!port.name.startsWith('pocket-sidepanel:')) return;
  const id = Number(port.name.slice('pocket-sidepanel:'.length));
  void update(async () => {
    await verify(port.sender, id);
    ports.set(id, port);
    port.onDisconnect.addListener(() => {
      if (ports.get(id) === port) ports.delete(id);
    });
    port.postMessage({ type: 'connected', state: getState(id) });
  }).catch(error => {
    if (!['errorPanelOnly', 'errorWindowClosed'].includes(error.code))
      reportFailure('Connect panel', error);
    port.disconnect();
  });
});

chrome.windows.onRemoved.addListener(id => {
  void update(async () => {
    delete windows[id];
    ports.delete(id);
    await chrome.storage.session.set({ [WINDOWS_KEY]: windows });
  }).catch(error => reportFailure('Remove closed window state', error));
});

chrome.runtime.onStartup.addListener(() => {
  // Context menus persist across restarts, including a change of Chrome UI language.
  void update(() => chrome.contextMenus.update('open-pocket', { title: t('contextOpen') })).catch(
    error => reportFailure('Update context menu language', error)
  );
});

chrome.runtime.onInstalled.addListener(() => {
  void update(async () => {
    // Remove the known old page overlay; ordinary page contents remain untouched.
    const key = 'pocket-page-mount-v1';
    const previous = (
      await chrome.storage.session.get<{ [key: string]: { tabId?: number; id?: string } }>(key)
    )[key];
    if (previous?.tabId)
      await chrome.tabs
        .sendMessage(previous.tabId, { type: 'POCKET_REMOVE', id: previous.id }, { frameId: 0 })
        .catch(() => {
          // The legacy tab or its old content script may already be gone.
        });
    await chrome.storage.session.remove(key);
    await chrome.contextMenus.removeAll();
    await new Promise<void>((resolve, reject) => {
      chrome.contextMenus.create(
        {
          id: 'open-pocket',
          title: t('contextOpen'),
          contexts: ['page', 'link', 'action'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        () => {
          const error = chrome.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve();
        }
      );
    });
  }).catch(error => reportFailure('Install context menu and migrate legacy state', error));
});

function openFromGesture(windowId: number, input: unknown, title?: string) {
  // Call open before any await so Chrome retains the user's gesture.
  const opened = chrome.sidePanel.open({ windowId });
  void update(() => navigate(windowId, input, title)).catch(error =>
    reportFailure('Open requested page', error)
  );
  void opened.catch(error => reportFailure('Open side panel', error));
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-pocket' && tab?.windowId)
    openFromGesture(
      tab.windowId,
      info.linkUrl || tab.url,
      !info.linkUrl || info.linkUrl === tab.url ? tab.title : undefined
    );
});

chrome.commands.onCommand.addListener((name, tab) => {
  if (name === 'open-current' && isWebUrl(tab?.url))
    openFromGesture(tab.windowId, tab.url, tab.title);
});
