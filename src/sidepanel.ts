import { element } from './dom.js';
import { validTheme } from './theme-preference.js';
import type { PanelSnapshot, BackgroundMessage } from './types.js';
import { PanelViewport } from './viewport.js';
import { parseInput, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { navigatePanel, commitPanelNavigation } from './sidepanel-state.js';
import { localizeDocument, t, errorMessage } from './i18n.js';
import { createPanelClient } from './panel-client.js';
import { RecentMenu } from './recent-menu.js';
import { RecentTitleTracker } from './recent-urls.js';

localizeDocument();

const web = element<HTMLIFrameElement>('#web');
const address = element<HTMLInputElement>('#address');
const notice = element('#notice');
const empty = element('#empty');
const emptyCurrent = element<HTMLButtonElement>('#empty-current');
const retry = element('#retry');
const moreMenu = element('#more-menu');
const moreButton = element('#more');
const windowId = (await chrome.windows.getCurrent()).id;
if (windowId === undefined) throw new Error('Current window has no ID');

let state: PanelSnapshot;
let loadingTimer: ReturnType<typeof setTimeout> | undefined;
let pendingNavigation = false;
let started = false;
let operation: Promise<unknown> = Promise.resolve();

let recentTitleTracker = new RecentTitleTracker();
const viewport = new PanelViewport(web, element('#viewport'), () => state?.mode);
const serial = <T>(task: () => T | PromiseLike<T>): Promise<T> => {
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
  element('span', notice).textContent = text;
  retry.hidden = !canRetry;
}

function controls() {
  recentMenu.render(state);
  document.body.classList.toggle('mobile', state?.mode === 'mobile');
  viewport.apply();
  const mode = element('#mode');
  const mobile = state?.mode === 'mobile';
  element('#mode-label').textContent = mobile ? t('switchToDesktop') : t('switchToMobile');
  mode.title = mobile ? t('mobileModeTitle') : t('desktopModeTitle');
  mode.setAttribute('aria-label', mode.title);
  element<HTMLButtonElement>('#back').disabled = !state || state.historyIndex <= 0;
  element<HTMLButtonElement>('#forward').disabled =
    !state || state.historyIndex >= state.history.length - 1;
  element<HTMLButtonElement>('#reload').disabled = !state?.url;
  element<HTMLButtonElement>('#external').disabled = !state?.url;
  element<HTMLButtonElement>('#close-page').disabled = !state?.url;
  emptyCurrent.disabled = !state;
}

function load(url: string) {
  if (!url) {
    clearTimeout(loadingTimer);
    showNotice();
    pendingNavigation = false;
    started = false;
    address.value = '';
    empty.hidden = false;
    // Destroy the old browsing context so late messages cannot reopen the page.
    web.remove();
    web.removeAttribute('src');
    viewport.stage.append(web);
    viewport.navigate();
    recentTitleTracker = new RecentTitleTracker();
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

function apply(next: PanelSnapshot, reload = false) {
  const previous = state;
  state = next;
  controls();
  if (document.activeElement !== address) address.value = state.url;
  if (!state.url) {
    if (started) load('');
  } else if (reload || !started || previous?.url !== state.url || previous?.mode !== state.mode)
    load(state.url);
}

function receiveBackgroundMessage(message: BackgroundMessage) {
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

async function navigate(input: string, historyIndex?: number) {
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
    !started ||
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
  void serial(async () => {
    if (!state?.url || !started || event.source !== web.contentWindow) return;
    viewport.accept(event.data, event.origin);
    if (event.data.type === 'POCKET_VIEWPORT') return;
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

element('#navigate').addEventListener('submit', event => {
  event.preventDefault();
  const input = address.value;
  address.blur();
  recentMenu.hide();
  void serial(() => navigate(input));
});
element<HTMLButtonElement>('#reload').onclick = () => {
  if (state?.url) load(state.url);
};
element<HTMLButtonElement>('#back').onclick = () => {
  if (state?.historyIndex > 0)
    void serial(() => navigate(state.history[state.historyIndex - 1], state.historyIndex - 1));
};
element<HTMLButtonElement>('#forward').onclick = () => {
  if (state && state.historyIndex < state.history.length - 1)
    void serial(() => navigate(state.history[state.historyIndex + 1], state.historyIndex + 1));
};
element('#mode').onclick = () => {
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
function openCurrent() {
  emptyCurrent.disabled = true;
  void serial(async () => {
    try {
      apply(await request('PANEL_CURRENT'));
    } finally {
      emptyCurrent.disabled = false;
    }
  });
}
element('#current').onclick = openCurrent;
emptyCurrent.onclick = openCurrent;
element('#empty-address').onclick = () => {
  address.focus();
  address.select();
};
element<HTMLButtonElement>('#external').onclick = () => {
  void serial(() => request('PANEL_EXTERNAL'));
};
element<HTMLButtonElement>('#close-page').onclick = () => {
  void serial(async () => {
    apply(await request('PANEL_CLOSE'));
    recentMenu.hide();
    address.focus();
  });
};
element('#help').onclick = () => {
  void serial(() => chrome.tabs.create({ windowId, url: chrome.runtime.getURL('help.html') }));
};
element('#settings').onclick = () => {
  void serial(() => chrome.runtime.openOptionsPage());
};
const themeButtons = [...moreMenu.querySelectorAll<HTMLButtonElement>('[data-theme-value]')];
for (const button of themeButtons) {
  button.addEventListener('click', () => {
    for (const option of themeButtons) option.disabled = true;
    moreMenu.hidePopover();
    void serial(async () => {
      try {
        await request('PANEL_THEME', { theme: validTheme(button.dataset.themeValue) });
      } finally {
        for (const option of themeButtons) option.disabled = false;
      }
    });
  });
}
moreMenu.addEventListener('click', event => {
  if (event.target instanceof Element && event.target.closest('button:not(:disabled)'))
    moreMenu.hidePopover();
});
document.addEventListener(
  'pointerdown',
  event => {
    const path = event.composedPath();
    if (!path.includes(moreMenu) && !path.includes(moreButton)) moreMenu.hidePopover();
  },
  true
);
// Pointer events inside the cross-origin webpage do not reach this document.
window.addEventListener('blur', () => moreMenu.hidePopover());
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
