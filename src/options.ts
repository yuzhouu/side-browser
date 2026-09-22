import { element } from './dom.js';
import { shortcutsUrl } from './browser.js';
import { validMode } from './config.js';
import { SEARCH_ENGINE_KEY, validSearchEngine } from './search-engine.js';
import { validTheme } from './theme-preference.js';
import type { Settings, SettingsRequests, RequestArgs, Response } from './types.js';
import { localizeDocument, t, errorMessage } from './i18n.js';
import { MODE_KEY } from './sidepanel-state.js';
import { RECENT_KEY } from './recent-urls.js';
import { userError } from './errors.js';
import { THEME_KEY } from './theme-preference.js';

localizeDocument();
const mode = element<HTMLSelectElement>('#mode');
const theme = element<HTMLSelectElement>('#theme');
const searchEngine = element<HTMLSelectElement>('#search-engine');
const clear = element<HTMLButtonElement>('#clear-recent');
const confirmation = element('#clear-confirmation');
const confirmClear = element<HTMLButtonElement>('#confirm-clear');
const cancelClear = element<HTMLButtonElement>('#cancel-clear');
const status = element('#settings-status');
const retry = element('#retry-settings');
let settings: Settings | undefined;
let busy = false;
let refreshId = 0;

async function request<K extends keyof SettingsRequests>(
  type: K,
  ...args: RequestArgs<SettingsRequests[K][0]>
): Promise<Settings> {
  const response: Response<Settings> | undefined = await chrome.runtime.sendMessage({
    type,
    ...args[0]
  });
  if (!response) throw userError('errorExtensionUnavailable');
  if (!response.ok) throw Object.assign(new Error(response.error), { code: response.errorCode });
  return response.data;
}

function render() {
  mode.disabled = busy || !settings;
  theme.disabled = busy || !settings;
  searchEngine.disabled = busy || !settings;
  clear.disabled = busy || !settings?.recentCount;
  confirmClear.disabled = cancelClear.disabled = busy;
  if (!settings) return;
  if (!busy) {
    mode.value = settings.mode;
    theme.value = settings.theme;
    searchEngine.value = settings.searchEngine;
  }
  element('#recent-count').textContent = t('settingsRecentCount', String(settings.recentCount));
  if (!settings.recentCount) confirmation.hidden = true;
}

function showStatus(message: string, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

async function refresh() {
  const id = ++refreshId;
  try {
    const next = await request('SETTINGS_GET');
    if (id !== refreshId) return;
    settings = next;
    retry.hidden = true;
    render();
  } catch (error) {
    if (id !== refreshId) return;
    showStatus(errorMessage(error), true);
    retry.hidden = false;
  }
}

async function change<K extends keyof SettingsRequests>(
  type: K,
  args: RequestArgs<SettingsRequests[K][0]>,
  message: string
) {
  if (busy) return;
  busy = true;
  // Discard any older read that is still in flight.
  refreshId++;
  render();
  showStatus(t('settingsSaving'));
  try {
    settings = await request(type, ...args);
    confirmation.hidden = true;
    showStatus(t(message));
  } catch (error) {
    showStatus(errorMessage(error), true);
  } finally {
    busy = false;
    render();
    await refresh();
  }
}

mode.addEventListener('change', () =>
  change('SETTINGS_MODE', [{ mode: validMode(mode.value) }], 'settingsSaved')
);
theme.addEventListener('change', () =>
  change('SETTINGS_THEME', [{ theme: validTheme(theme.value) }], 'settingsSaved')
);
searchEngine.addEventListener('change', () =>
  change(
    'SETTINGS_SEARCH_ENGINE',
    [{ searchEngine: validSearchEngine(searchEngine.value) }],
    'settingsSaved'
  )
);
clear.addEventListener('click', () => {
  confirmation.hidden = false;
  cancelClear.focus();
});
cancelClear.addEventListener('click', () => {
  confirmation.hidden = true;
  clear.focus();
});
confirmClear.addEventListener('click', async () => {
  await change('SETTINGS_CLEAR_RECENT', [], 'settingsCleared');
  if (confirmation.hidden) mode.focus();
});
confirmation.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !busy) cancelClear.click();
});
retry.addEventListener('click', () => {
  showStatus('');
  void refresh();
});
element('#manage-shortcut').addEventListener('click', () => {
  void chrome.tabs.create({ url: shortcutsUrl(navigator.userAgent) }).catch(error => {
    showStatus(errorMessage(error), true);
  });
});
async function readShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    element('#shortcut').textContent =
      commands.find(command => command.name === 'open-current')?.shortcut ||
      t('settingsShortcutUnset');
  } catch (error) {
    showStatus(errorMessage(error), true);
  }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'local' &&
    (MODE_KEY in changes ||
      THEME_KEY in changes ||
      SEARCH_ENGINE_KEY in changes ||
      RECENT_KEY in changes) &&
    !busy
  )
    void refresh();
});
window.addEventListener('focus', () => {
  if (!busy) void refresh();
  void readShortcut();
});
void refresh();
void readShortcut();
