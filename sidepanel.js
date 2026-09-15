import { PanelViewport } from './viewport.js';
import { parseInput, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { navigatePanel, commitPanelNavigation } from './sidepanel-state.js';
const web = document.querySelector('#web'), address = document.querySelector('#address');
const notice = document.querySelector('#notice'), empty = document.querySelector('#empty'), retry = document.querySelector('#retry');
const moreMenu = document.querySelector('#more-menu');
const windowId = (await chrome.windows.getCurrent()).id;
let state, port, loadingTimer, pendingNavigation = false, started = false, operation = Promise.resolve();
const viewport = new PanelViewport(web, document.querySelector('#viewport'), () => state?.mode);
const serial = task => { const next = operation.then(task); operation = next.catch(error => showNotice(error.message, true)); return next; };
async function request(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, windowId, ...data });
  if (!response?.ok) throw new Error(response?.error || '扩展没有响应，请重试。');
  return response.data;
}
function showNotice(text = '', canRetry = false) { notice.hidden = !text; notice.querySelector('span').textContent = text; retry.hidden = !canRetry; }
function controls() {
  document.body.classList.toggle('mobile', state?.mode === 'mobile');
  viewport.apply();
  const mode = document.querySelector('#mode'), mobile = state?.mode === 'mobile';
  document.querySelector('#mode-label').textContent = mobile ? '切换为 PC 模式' : '切换为手机模式';
  mode.title = `当前为${mobile ? '手机' : 'PC'}模式，点击切换为${mobile ? 'PC' : '手机'}模式`;
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
  loadingTimer = setTimeout(() => showNotice('网页加载时间较长，可刷新重试，或从「⋯」在新标签页打开。'), 12000);
  viewport.navigate(); web.src = url; started = true;
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
      if (message.type === 'mode' && state && message.mode !== state.mode) { state.mode = message.mode; controls(); if (state.url) load(state.url); }
    });
  });
  port.onDisconnect.addListener(() => { port = null; setTimeout(connect, 250); });
}
async function navigate(input, historyIndex) {
  const url = frameDestination(input, parseInput);
  navigatePanel(state, url, historyIndex); state = await request('PANEL_SAVE', { state }); controls(); load(url);
}
window.addEventListener('message', event => {
  if (event.source !== web.contentWindow || !['POCKET_LOCATION', 'POCKET_VIEWPORT'].includes(event.data?.type) || !isWebUrl(event.data.url)) return;
  try { if (new URL(event.data.url).origin !== event.origin) return; } catch { return; }
  viewport.accept(event.data, event.origin);
  if (event.data.type !== 'POCKET_LOCATION') return;
  void serial(async () => {
    if (!state) return;
    commitPanelNavigation(state, event.data.url, pendingNavigation); pendingNavigation = false;
    if (document.activeElement !== address) address.value = state.url;
    empty.hidden = true; clearTimeout(loadingTimer); showNotice(); controls();
    state = await request('PANEL_SAVE', { state });
  });
});
document.querySelector('#navigate').addEventListener('submit', event => { event.preventDefault(); address.blur(); void serial(() => navigate(address.value)); });
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
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); moreMenu.hidePopover(); address.focus(); address.select(); } });
await serial(async () => { apply(await request('PANEL_READY')); connect(); });
