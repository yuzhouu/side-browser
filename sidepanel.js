import { PanelViewport } from './viewport.js';
import { parseInput, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { navigatePanel, commitPanelNavigation } from './sidepanel-state.js';
import { localizeDocument, t, errorMessage } from './i18n.js';
import { userError } from './errors.js';
import { recentFaviconUrl, RecentTitleTracker } from './recent-urls.js';
localizeDocument();
const web = document.querySelector('#web'), address = document.querySelector('#address');
const notice = document.querySelector('#notice'), empty = document.querySelector('#empty'), retry = document.querySelector('#retry');
const moreMenu = document.querySelector('#more-menu');
const recentMenu = document.querySelector('#recent-menu'), recentList = document.querySelector('#recent-list');
const recentTemplate = document.querySelector('#recent-item-template'), extensionRoot = chrome.runtime.getURL('/');
const windowId = (await chrome.windows.getCurrent()).id;
let state, port, loadingTimer, pendingNavigation = false, started = false, operation = Promise.resolve();
let renderedRecent = '';
const recentTitleTracker = new RecentTitleTracker();
const viewport = new PanelViewport(web, document.querySelector('#viewport'), () => state?.mode);
const serial = task => { const next = operation.then(task); operation = next.catch(error => showNotice(errorMessage(error), true)); return next; };
async function request(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, windowId, ...data });
  if (!response) throw userError('errorExtensionUnavailable');
  if (!response.ok) throw Object.assign(new Error(response.error), { code: response.errorCode });
  return response.data;
}
function showNotice(text = '', canRetry = false) { notice.hidden = !text; notice.querySelector('span').textContent = text; retry.hidden = !canRetry; }
function renderRecent() {
  const urls = state?.recentUrls || [], key = JSON.stringify(urls);
  if (renderedRecent !== key) {
    renderedRecent = key;
    recentList.replaceChildren(...urls.map(url => {
      const item = recentTemplate.content.firstElementChild.cloneNode(true);
      const button = item.querySelector('.recent-open'), remove = item.querySelector('.recent-remove');
      const icon = item.querySelector('img'), fallback = item.querySelector('.recent-icon svg');
      button.dataset.url = url; button.title = url;
      item.querySelector('.recent-label').textContent = new URL(url).host;
      item.querySelector('.recent-url').textContent = url;
      remove.dataset.url = url; remove.title = t('removeRecent');
      remove.setAttribute('aria-label', `${t('removeRecent')}: ${url}`);
      icon.onload = () => { icon.hidden = false; fallback.setAttribute('hidden', ''); };
      icon.onerror = () => { icon.hidden = true; fallback.removeAttribute('hidden'); };
      icon.src = recentFaviconUrl(url, extensionRoot);
      return item;
    }));
  }
  for (const button of recentList.querySelectorAll('.recent-open')) {
    const url = button.dataset.url, title = state?.recentTitles?.[url];
    button.querySelector('.recent-label').textContent = title || new URL(url).host;
    button.title = title ? `${title}\n${url}` : url;
    if (button.dataset.url === state?.url) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  document.querySelector('#clear-recent').disabled = !urls.length;
  document.querySelector('#recent-empty').hidden = !!urls.length;
}
function controls() {
  renderRecent();
  document.body.classList.toggle('mobile', state?.mode === 'mobile');
  viewport.apply();
  const mode = document.querySelector('#mode'), mobile = state?.mode === 'mobile';
  document.querySelector('#mode-label').textContent = mobile ? t('switchToDesktop') : t('switchToMobile');
  mode.title = mobile ? t('mobileModeTitle') : t('desktopModeTitle');
  mode.setAttribute('aria-label', mode.title);
  document.querySelector('#back').disabled = !state || state.historyIndex <= 0;
  document.querySelector('#forward').disabled = !state || state.historyIndex >= state.history.length - 1;
  document.querySelector('#reload').disabled = !state?.url;
  document.querySelector('#external').disabled = !state?.url;
}
function load(url) {
  if (!url) { empty.hidden = false; return; }
  showNotice(); address.value = url; empty.hidden = true; pendingNavigation = true;
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => showNotice(t('loadingSlow')), 12000);
  viewport.navigate(); recentTitleTracker.navigate(url); web.src = url; started = true;
}
function apply(next, reload = false) {
  const previous = state; state = next; controls();
  if (document.activeElement !== address) address.value = state.url;
  if (state.url && (reload || !started || previous?.url !== state.url || previous?.mode !== state.mode)) load(state.url);
}
function connect() {
  if (port) return;
  port = chrome.runtime.connect({ name: `pocket-sidepanel:${windowId}` });
  port.onMessage.addListener(message => {
    void serial(async () => {
      if (message.type === 'connected') { apply(message.state); showNotice(); }
      if (message.type === 'navigate') apply(message.state);
      if (message.type === 'recent' && state) { state.recentUrls = message.urls; state.recentTitles = message.titles || {}; renderRecent(); }
      if (message.type === 'mode' && state && message.mode !== state.mode) { state.mode = message.mode; controls(); if (state.url) load(state.url); }
    });
  });
  port.onDisconnect.addListener(() => { port = null; setTimeout(connect, 250); });
}
async function navigate(input, historyIndex) {
  if (!Number.isInteger(historyIndex)) {
    apply(await request('PANEL_NAVIGATE', { input }), true);
    return;
  }
  const url = frameDestination(input, parseInput);
  navigatePanel(state, url, historyIndex); state = await request('PANEL_SAVE', { state }); controls(); load(url);
}
window.addEventListener('message', event => {
  if (event.source !== web.contentWindow || !['POCKET_LOCATION', 'POCKET_VIEWPORT', 'POCKET_TITLE'].includes(event.data?.type) || !isWebUrl(event.data.url)) return;
  try { if (new URL(event.data.url).origin !== event.origin) return; } catch { return; }
  viewport.accept(event.data, event.origin);
  if (event.data.type === 'POCKET_VIEWPORT') return;
  void serial(async () => {
    if (!state) return;
    const metadata = recentTitleTracker.accept(event.data);
    if (event.data.type === 'POCKET_LOCATION') {
      commitPanelNavigation(state, event.data.url, pendingNavigation); pendingNavigation = false;
      if (document.activeElement !== address) address.value = state.url;
      empty.hidden = true; clearTimeout(loadingTimer); showNotice(); controls();
      state = await request('PANEL_SAVE', { state });
    }
    if (metadata && state.recentUrls.includes(metadata.url) && state.recentTitles?.[metadata.url] !== metadata.title) {
      state.recentTitles = await request('PANEL_RECENT_TITLE', metadata); renderRecent();
    }
  });
});
document.querySelector('#navigate').addEventListener('submit', event => { event.preventDefault(); const input = address.value; address.blur(); recentMenu.hidePopover(); void serial(() => navigate(input)); });
document.addEventListener('pointerdown', event => {
  const path = event.composedPath();
  if (!path.includes(recentMenu) && !path.includes(document.querySelector('#recent'))) recentMenu.hidePopover();
}, true);
// Pointer events inside the cross-origin webpage do not bubble to this document.
window.addEventListener('blur', () => recentMenu.hidePopover());
recentList.addEventListener('click', event => {
  const button = event.target.closest('button[data-url]');
  if (!button) return;
  if (button.matches('.recent-remove')) {
    const index = [...recentList.querySelectorAll('.recent-remove')].indexOf(button);
    void serial(async () => {
      state.recentUrls = await request('PANEL_REMOVE_RECENT', { url: button.dataset.url });
      renderRecent();
      const remaining = recentList.querySelectorAll('.recent-remove');
      (remaining[Math.min(index, remaining.length - 1)] || document.querySelector('#recent')).focus();
    });
    return;
  }
  recentMenu.hidePopover();
  void serial(() => navigate(button.dataset.url));
});
document.querySelector('#clear-recent').onclick = () => { void serial(async () => {
  const urls = await request('PANEL_CLEAR_RECENT');
  state.recentUrls = urls; renderRecent(); document.querySelector('#recent').focus();
}); };
recentList.addEventListener('keydown', event => {
  const selector = document.activeElement.matches('.recent-remove') ? '.recent-remove' : '.recent-open';
  const buttons = [...recentList.querySelectorAll(selector)], index = buttons.indexOf(document.activeElement);
  if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus();
});
document.querySelector('#reload').onclick = () => { if (state?.url) load(state.url); };
document.querySelector('#back').onclick = () => { if (state?.historyIndex > 0) void serial(() => navigate(state.history[state.historyIndex - 1], state.historyIndex - 1)); };
document.querySelector('#forward').onclick = () => { if (state && state.historyIndex < state.history.length - 1) void serial(() => navigate(state.history[state.historyIndex + 1], state.historyIndex + 1)); };
document.querySelector('#mode').onclick = () => { if (state) void serial(async () => {
  const mode = await request('PANEL_MODE', { mode: state.mode === 'mobile' ? 'desktop' : 'mobile' });
  if (state.mode !== mode) { state.mode = mode; controls(); if (state.url) load(state.url); }
}); };
document.querySelector('#current').onclick = () => { void serial(async () => apply(await request('PANEL_CURRENT'))); };
document.querySelector('#external').onclick = () => { void serial(() => request('PANEL_EXTERNAL')); };
moreMenu.addEventListener('click', event => {
  if (event.target.closest('button:not(:disabled)')) moreMenu.hidePopover();
});
retry.onclick = () => { void serial(async () => { apply(await request('PANEL_READY'), true); connect(); }); };
web.addEventListener('load', () => { if (started) { empty.hidden = true; clearTimeout(loadingTimer); } });
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); moreMenu.hidePopover(); recentMenu.hidePopover(); address.focus(); address.select(); } });
await serial(async () => { apply(await request('PANEL_READY')); connect(); });
