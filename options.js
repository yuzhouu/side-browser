import { localizeDocument, t, errorMessage } from './i18n.js';
import { MODE_KEY } from './sidepanel-state.js';
import { RECENT_KEY } from './recent-urls.js';
import { userError } from './errors.js';

localizeDocument();
const mode = document.querySelector('#mode');
const clear = document.querySelector('#clear-recent');
const confirmation = document.querySelector('#clear-confirmation');
const confirmClear = document.querySelector('#confirm-clear');
const cancelClear = document.querySelector('#cancel-clear');
const status = document.querySelector('#settings-status');
const retry = document.querySelector('#retry-settings');
let settings;
let busy = false;
let refreshId = 0;

async function request(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...data });
  if (!response) throw userError('errorExtensionUnavailable');
  if (!response.ok) throw Object.assign(new Error(response.error), { code: response.errorCode });
  return response.data;
}

function render() {
  mode.disabled = busy || !settings;
  clear.disabled = busy || !settings?.recentCount;
  confirmClear.disabled = cancelClear.disabled = busy;
  if (!settings) return;
  if (!busy) mode.value = settings.mode;
  document.querySelector('#recent-count').textContent = t(
    'settingsRecentCount',
    String(settings.recentCount)
  );
  if (!settings.recentCount) confirmation.hidden = true;
}

function showStatus(message, error = false) {
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

async function change(type, data, message) {
  if (busy) return;
  busy = true;
  // Discard any older read that is still in flight.
  refreshId++;
  render();
  showStatus(t('settingsSaving'));
  try {
    settings = await request(type, data);
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
  change('SETTINGS_MODE', { mode: mode.value }, 'settingsSaved')
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
  await change('SETTINGS_CLEAR_RECENT', {}, 'settingsCleared');
  if (confirmation.hidden) mode.focus();
});
confirmation.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !busy) cancelClear.click();
});
retry.addEventListener('click', () => {
  showStatus('');
  void refresh();
});
document.querySelector('#manage-shortcut').addEventListener('click', () => {
  void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(error => {
    showStatus(errorMessage(error), true);
  });
});
async function readShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    document.querySelector('#shortcut').textContent =
      commands.find(command => command.name === 'open-current')?.shortcut ||
      t('settingsShortcutUnset');
  } catch (error) {
    showStatus(errorMessage(error), true);
  }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (MODE_KEY in changes || RECENT_KEY in changes) && !busy) void refresh();
});
window.addEventListener('focus', () => {
  if (!busy) void refresh();
  void readShortcut();
});
void refresh();
void readShortcut();
