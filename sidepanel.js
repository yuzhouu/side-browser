import { PanelViewport } from './viewport.js';
import { parseInput, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { navigatePanel, commitPanelNavigation } from './sidepanel-state.js';
import { localizeDocument, t, errorMessage } from './i18n.js';
import { createPanelClient } from './panel-client.js';
import { RecentMenu } from './recent-menu.js';
import { RecentTitleTracker } from './recent-urls.js';

localizeDocument();

const web = document.querySelector('#web');
const address = document.querySelector('#address');
const notice = document.querySelector('#notice');
const empty = document.querySelector('#empty');
const retry = document.querySelector('#retry');
const moreMenu = document.querySelector('#more-menu');
const windowId = (await chrome.windows.getCurrent()).id;

let state;
let loadingTimer;
let pendingNavigation = false;
let started = false;
let operation = Promise.resolve();

const recentTitleTracker = new RecentTitleTracker();
const viewport = new PanelViewport(web, document.querySelector('#viewport'), () => state?.mode);
const serial = task => {
  const next = operation.then(task);
  operation = next.catch(error => showNotice(errorMessage(error), true));
  return next;
};
const { request, connect } = createPanelClient(windowId, message => {
  void serial(() => receiveBackgroundMessage(message));
});
const recentMenu = new RecentMenu({
  run: serial,
  onOpen: navigate,
  onRemove: async url => {
    state.recentUrls = await request('PANEL_REMOVE_RECENT', { url });
    return state;
  },
  onClear: async () => {
    state.recentUrls = await request('PANEL_CLEAR_RECENT');
    return state;
  }
});

function showNotice(text = '', canRetry = false) {
  notice.hidden = !text;
  notice.querySelector('span').textContent = text;
  retry.hidden = !canRetry;
}

function controls() {
  recentMenu.render(state);
  document.body.classList.toggle('mobile', state?.mode === 'mobile');
  viewport.apply();
  const mode = document.querySelector('#mode');
  const mobile = state?.mode === 'mobile';
  document.querySelector('#mode-label').textContent = mobile
    ? t('switchToDesktop')
    : t('switchToMobile');
  mode.title = mobile ? t('mobileModeTitle') : t('desktopModeTitle');
  mode.setAttribute('aria-label', mode.title);
  document.querySelector('#back').disabled = !state || state.historyIndex <= 0;
  document.querySelector('#forward').disabled =
    !state || state.historyIndex >= state.history.length - 1;
  document.querySelector('#reload').disabled = !state?.url;
  document.querySelector('#external').disabled = !state?.url;
}

function load(url) {
  if (!url) {
    empty.hidden = false;
    return;
  }
  showNotice();
  address.value = url;
  empty.hidden = true;
  pendingNavigation = true;
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => showNotice(t('loadingSlow')), 12000);
  viewport.navigate();
  recentTitleTracker.navigate(url);
  web.src = url;
  started = true;
}

function apply(next, reload = false) {
  const previous = state;
  state = next;
  controls();
  if (document.activeElement !== address) address.value = state.url;
  if (
    state.url &&
    (reload || !started || previous?.url !== state.url || previous?.mode !== state.mode)
  )
    load(state.url);
}

function receiveBackgroundMessage(message) {
  switch (message.type) {
    case 'connected':
      apply(message.state);
      showNotice();
      break;
    case 'navigate':
      apply(message.state);
      break;
    case 'recent':
      if (state) {
        state.recentUrls = message.urls;
        state.recentTitles = message.titles || {};
        recentMenu.render(state);
      }
      break;
    case 'mode':
      if (state && message.mode !== state.mode) {
        state.mode = message.mode;
        controls();
        if (state.url) load(state.url);
      }
      break;
  }
}

async function navigate(input, historyIndex) {
  if (!Number.isInteger(historyIndex)) {
    apply(await request('PANEL_NAVIGATE', { input }), true);
    return;
  }
  const url = frameDestination(input, parseInput);
  navigatePanel(state, url, historyIndex);
  state = await request('PANEL_SAVE', { state });
  controls();
  load(url);
}

window.addEventListener('message', event => {
  if (
    event.source !== web.contentWindow ||
    !['POCKET_LOCATION', 'POCKET_VIEWPORT', 'POCKET_TITLE'].includes(event.data?.type) ||
    !isWebUrl(event.data.url)
  )
    return;
  try {
    if (new URL(event.data.url).origin !== event.origin) return;
  } catch {
    return;
  }
  viewport.accept(event.data, event.origin);
  if (event.data.type === 'POCKET_VIEWPORT') return;
  void serial(async () => {
    if (!state) return;
    const metadata = recentTitleTracker.accept(event.data);
    if (event.data.type === 'POCKET_LOCATION') {
      commitPanelNavigation(state, event.data.url, pendingNavigation);
      pendingNavigation = false;
      if (document.activeElement !== address) address.value = state.url;
      empty.hidden = true;
      clearTimeout(loadingTimer);
      showNotice();
      controls();
      state = await request('PANEL_SAVE', { state });
    }
    if (
      metadata &&
      state.recentUrls.includes(metadata.url) &&
      state.recentTitles?.[metadata.url] !== metadata.title
    ) {
      state.recentTitles = await request('PANEL_RECENT_TITLE', metadata);
      recentMenu.render(state);
    }
  });
});

document.querySelector('#navigate').addEventListener('submit', event => {
  event.preventDefault();
  const input = address.value;
  address.blur();
  recentMenu.hide();
  void serial(() => navigate(input));
});
document.querySelector('#reload').onclick = () => {
  if (state?.url) load(state.url);
};
document.querySelector('#back').onclick = () => {
  if (state?.historyIndex > 0)
    void serial(() => navigate(state.history[state.historyIndex - 1], state.historyIndex - 1));
};
document.querySelector('#forward').onclick = () => {
  if (state && state.historyIndex < state.history.length - 1)
    void serial(() => navigate(state.history[state.historyIndex + 1], state.historyIndex + 1));
};
document.querySelector('#mode').onclick = () => {
  if (state)
    void serial(async () => {
      const mode = await request('PANEL_MODE', {
        mode: state.mode === 'mobile' ? 'desktop' : 'mobile'
      });
      if (state.mode !== mode) {
        state.mode = mode;
        controls();
        if (state.url) load(state.url);
      }
    });
};
document.querySelector('#current').onclick = () => {
  void serial(async () => apply(await request('PANEL_CURRENT')));
};
document.querySelector('#external').onclick = () => {
  void serial(() => request('PANEL_EXTERNAL'));
};
document.querySelector('#help').onclick = () => {
  void serial(() => chrome.tabs.create({ windowId, url: chrome.runtime.getURL('help.html') }));
};
moreMenu.addEventListener('click', event => {
  if (event.target.closest('button:not(:disabled)')) moreMenu.hidePopover();
});
retry.onclick = () => {
  void serial(async () => {
    apply(await request('PANEL_READY'), true);
    connect();
  });
};
web.addEventListener('load', () => {
  if (started) {
    empty.hidden = true;
    clearTimeout(loadingTimer);
  }
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    moreMenu.hidePopover();
    recentMenu.hide();
    address.focus();
    address.select();
  }
});

await serial(async () => {
  apply(await request('PANEL_READY'));
  connect();
});
