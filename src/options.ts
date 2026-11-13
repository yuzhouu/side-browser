import { element } from './dom.js';
import { shortcutsUrl } from './browser.js';
import { validMode } from './config.js';
import { CUSTOM_SEARCH_ENGINE_KEY, SEARCH_ENGINE_KEY } from './search-engine.js';
import { SearchEngineSettings } from './search-engine-settings.js';
import { validTheme } from './theme-preference.js';
import type { Settings, SettingsRequests, RequestArgs, Response } from './types.js';
import { localizeDocument, t, errorMessage } from './i18n.js';
import { MODE_KEY } from './sidepanel-state.js';
import { RECENT_KEY } from './recent-urls.js';
import { userError } from './errors.js';
import { THEME_KEY } from './theme-preference.js';
import { SITE_PREFERENCES_KEY } from './site-preferences.js';
import { FAVORITES_KEY } from './favorites.js';
import { FavoriteSettings } from './favorite-settings.js';
import { RETURN_HOME_AFTER_OPEN_KEY } from './open-tab-preference.js';

localizeDocument();
const mode = element<HTMLSelectElement>('#mode');
const theme = element<HTMLSelectElement>('#theme');
const returnHomeAfterOpen = element<HTMLInputElement>('#return-home-after-open');
const clear = element<HTMLButtonElement>('#clear-recent');
const confirmation = element('#clear-confirmation');
const confirmClear = element<HTMLButtonElement>('#confirm-clear');
const cancelClear = element<HTMLButtonElement>('#cancel-clear');
const status = element('#settings-status');
const retry = element('#retry-settings');
let settings: Settings | undefined;
let busy = false;
let refreshId = 0;
let favoritesTargeted = false;
const favoriteSettings = new FavoriteSettings({
  onRemove: url => changeFavorites('SETTINGS_REMOVE_FAVORITE', [{ url }]),
  onUpdate: (url, newUrl, title) =>
    changeFavorites('SETTINGS_UPDATE_FAVORITE', [{ url, newUrl, title }]),
  onMove: (url, targetUrl, position) =>
    changeFavorites('SETTINGS_MOVE_FAVORITE', [{ url, targetUrl, position }])
});
const searchSettings = new SearchEngineSettings(
  engine => change('SETTINGS_SEARCH_ENGINE', [{ searchEngine: engine }], 'settingsSaved'),
  async customSearchEngine => {
    const result = await change(
      'SETTINGS_CUSTOM_SEARCH_ENGINE',
      [{ customSearchEngine }],
      'settingsSaved'
    );
    if (result && !result.ok) searchSettings.showError(result.error);
    return result?.ok === true;
  }
);

async function changeFavorites<K extends keyof SettingsRequests>(
  type: K,
  args: RequestArgs<SettingsRequests[K][0]>
) {
  const result = await change(type, args, 'settingsSaved');
  if (!result) return;
  if (!result.ok) throw result.error;
  return settings?.favorites;
}

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
  favoriteSettings.render(settings?.favorites || [], busy || !settings);
  mode.disabled = busy || !settings;
  theme.disabled = busy || !settings;
  returnHomeAfterOpen.disabled = busy || !settings;
  searchSettings.render(settings, busy);
  clear.disabled = busy || !settings?.recentCount;
  confirmClear.disabled = cancelClear.disabled = busy;
  if (!settings) return;
  if (!busy) {
    mode.value = settings.mode;
    theme.value = settings.theme;
    returnHomeAfterOpen.checked = settings.returnHomeAfterOpen;
  }
  element('#recent-count').textContent = t('settingsRecentCount', String(settings.recentCount));
  if (!settings.recentCount) confirmation.hidden = true;
  const sites = Object.entries(settings.sitePreferences).sort(([a], [b]) => a.localeCompare(b));
  element('#sites-empty').hidden = sites.length > 0;
  element('#site-preferences').replaceChildren(
    ...sites.map(([hostname, preference]) => {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const description = document.createElement('div');
      description.className = 'setting-copy';
      const name = document.createElement('h3');
      name.textContent = hostname;
      const detail = document.createElement('p');
      detail.textContent = t(
        preference.requestMobile
          ? 'requestMobile'
          : preference.mode === 'mobile'
            ? 'settingsMobile'
            : 'settingsDesktop'
      );
      description.append(name, detail);
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.textContent = t('resetSite');
      reset.setAttribute('aria-label', `${t('resetSite')} · ${hostname}`);
      reset.dataset.hostname = hostname;
      reset.disabled = busy;
      reset.addEventListener('click', async () => {
        await change('SETTINGS_RESET_SITE', [{ hostname }], 'settingsSaved');
        element<HTMLHeadingElement>('#sites-heading').focus();
      });
      row.append(description, reset);
      return row;
    })
  );
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
    if (!favoritesTargeted && location.hash === '#favorites') {
      favoritesTargeted = true;
      element('#favorites').scrollIntoView({ block: 'start' });
      element('#favorites-heading').focus({ preventScroll: true });
    }
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
    return { ok: true, settings } as const;
  } catch (error) {
    showStatus(errorMessage(error), true);
    return { ok: false, error } as const;
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
returnHomeAfterOpen.addEventListener('change', () =>
  change(
    'SETTINGS_RETURN_HOME_AFTER_OPEN',
    [{ returnHomeAfterOpen: returnHomeAfterOpen.checked }],
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
      SITE_PREFERENCES_KEY in changes ||
      THEME_KEY in changes ||
      SEARCH_ENGINE_KEY in changes ||
      CUSTOM_SEARCH_ENGINE_KEY in changes ||
      RETURN_HOME_AFTER_OPEN_KEY in changes ||
      FAVORITES_KEY in changes ||
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
