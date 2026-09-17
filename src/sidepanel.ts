import { element } from './dom.js';
import { validTheme } from './theme-preference.js';
import type { PanelSnapshot, BackgroundMessage, Mode, Favorite } from './types.js';
import { PanelPage } from './panel-page.js';
import { parseInput, isWebUrl } from './config.js';
import { frameDestination } from './embedding.js';
import { navigatePanel, commitPanelNavigation } from './sidepanel-state.js';
import { localizeDocument, t, errorMessage } from './i18n.js';
import { createPanelClient } from './panel-client.js';
import { RecentMenu } from './recent-menu.js';
import { FavoriteList } from './favorite-list.js';

localizeDocument();

const initialStage = element('#viewport');
const stageTemplate = initialStage.cloneNode(true) as HTMLElement;
stageTemplate.removeAttribute('id');
stageTemplate.querySelector('iframe')!.removeAttribute('id');
const pages = new Map<number | null, PanelPage>();
let active: PanelPage;
let sourceTabId: number | undefined;
let bindingBusy = false;
const address = element<HTMLInputElement>('#address');
const notice = element('#notice');
const empty = element('#empty');
const emptyCurrent = element<HTMLButtonElement>('#empty-current');
const retry = element('#retry');
const moreMenu = element('#more-menu');
const moreButton = element('#more');
const windowId = (await chrome.windows.getCurrent()).id;
if (windowId === undefined) throw new Error('Current window has no ID');
let operation: Promise<unknown> = Promise.resolve();

const serial = <T>(task: () => T | PromiseLike<T>): Promise<T> => {
  const next = operation.then(task);
  operation = next.catch(error => showNotice(errorMessage(error), true));
  return next;
};
const { request, requestFor, connect } = createPanelClient(
  windowId,
  message => {
    void serial(() => receiveBackgroundMessage(message));
  },
  () => active?.state.tabId
);
const recentMenu = new RecentMenu({
  run: serial,
  onOpen: input => navigate(input),
  onRemove: async url => {
    const urls = await request('PANEL_REMOVE_RECENT', { url });
    for (const page of pages.values()) page.state.recentUrls = urls;
    return active.state;
  },
  onClear: async () => {
    const urls = await request('PANEL_CLEAR_RECENT');
    for (const page of pages.values()) page.state.recentUrls = urls;
    return active.state;
  }
});
const favoriteList = new FavoriteList({
  run: serial,
  onOpen: input => navigate(input),
  onRemove: async url => {
    const favorites = await request('PANEL_REMOVE_FAVORITE', { url });
    setFavorites(favorites);
    return favorites;
  }
});

function setFavorites(favorites: Favorite[]) {
  for (const page of pages.values()) page.state.favorites = favorites;
  if (active && !active.disposed) render();
}

function showNotice(text = '', canRetry = false) {
  notice.hidden = !text;
  element('span', notice).textContent = text;
  retry.hidden = !canRetry;
}

function render(page = active) {
  if (page !== active || page.disposed) return;
  const state = page.state;
  recentMenu.render(state);
  favoriteList.render(state.favorites);
  const favorite = element<HTMLButtonElement>('#favorite');
  const saved = state.favorites.some(item => item.url === state.url);
  favorite.disabled = !state.url;
  favorite.setAttribute('aria-pressed', String(saved));
  favorite.title = t(saved ? 'removeFavorite' : 'addFavorite');
  element('#favorite-label').textContent = favorite.title;
  document.body.classList.toggle('mobile', state.mode === 'mobile');
  document.body.dataset.scope = state.tabId === null ? 'shared' : 'bound';
  document.body.dataset.tabId = String(state.tabId ?? 'shared');
  document.body.dataset.sourceTabId = String(sourceTabId ?? '');
  page.viewport.apply();
  if (document.activeElement !== address) address.value = state.url;
  empty.hidden = Boolean(state.url);
  showNotice(page.notice);
  const mode = element('#mode');
  const mobile = state.mode === 'mobile';
  element('#mode-label').textContent = mobile ? t('switchToDesktop') : t('switchToMobile');
  mode.title = mobile ? t('mobileModeTitle') : t('desktopModeTitle');
  mode.setAttribute('aria-label', mode.title);
  const bound = state.tabId !== null;
  const binding = element<HTMLButtonElement>('#binding');
  binding.setAttribute('aria-pressed', String(bound));
  binding.disabled = bindingBusy || sourceTabId === undefined;
  binding.title = t(bound ? 'unbindTabDescription' : 'bindTabDescription');
  element('#binding-label').textContent = t(bound ? 'unbindTab' : 'bindTab');
  element<HTMLButtonElement>('#back').disabled = state.historyIndex <= 0;
  element<HTMLButtonElement>('#forward').disabled = state.historyIndex >= state.history.length - 1;
  element<HTMLButtonElement>('#reload').disabled = !state.url;
  element<HTMLButtonElement>('#external').disabled = !state.url;
  element<HTMLButtonElement>('#close-page').disabled = !state.url;
  emptyCurrent.disabled = false;
}

function pageFor(state: PanelSnapshot) {
  let page = pages.get(state.tabId);
  if (!page) {
    const stage =
      initialStage.isConnected && !pages.size
        ? initialStage
        : (stageTemplate.cloneNode(true) as HTMLElement);
    stage.hidden = true;
    if (!stage.isConnected) empty.before(stage);
    page = new PanelPage(stage, state, render);
    pages.set(state.tabId, page);
  }
  return page;
}

function select(next: PanelSnapshot) {
  if (next.sourceTabId !== undefined) sourceTabId = next.sourceTabId;
  const cached = pages.get(next.tabId);
  if (cached) {
    // A tab activation snapshot may predate an in-flight report from its live page.
    // The mounted document owns navigation; activation only selects it and syncs preferences.
    next = {
      ...next,
      url: cached.state.url,
      history: cached.state.history,
      historyIndex: cached.state.historyIndex
    };
  }
  const page = pageFor(next);
  if (active !== page) {
    if (active) {
      active.stage.hidden = true;
      active.stage.removeAttribute('id');
      active.web.removeAttribute('id');
    }
    active = page;
    page.stage.id = 'viewport';
    page.web.id = 'web';
    page.stage.hidden = false;
    recentMenu.hide();
    moreMenu.hidePopover();
    address.value = next.url;
  }
  page.apply(next);
}

function setMode(mode: Mode) {
  for (const page of pages.values()) {
    if (page.state.mode !== mode) page.apply({ ...page.state, mode });
  }
}

function receiveBackgroundMessage(message: BackgroundMessage) {
  switch (message.type) {
    case 'connected':
    case 'activate':
      select(message.state);
      break;
    case 'navigate':
      pageFor(message.state).apply(message.state);
      break;
    case 'remove-tab': {
      const page = pages.get(message.tabId);
      if (page) {
        page.dispose();
        pages.delete(message.tabId);
      }
      break;
    }
    case 'recent':
      for (const page of pages.values()) {
        page.state.recentUrls = message.urls;
        page.state.recentTitles = message.titles || {};
      }
      if (active && !active.disposed) recentMenu.render(active.state);
      break;
    case 'mode':
      setMode(message.mode);
      break;
    case 'favorites':
      setFavorites(message.favorites);
      break;
  }
}

async function navigate(input: string, historyIndex?: number, page = active) {
  if (page.disposed) return;
  if (!Number.isInteger(historyIndex)) {
    page.apply(await requestFor(page.state.tabId, 'PANEL_NAVIGATE', { input }), true);
    return;
  }
  const url = frameDestination(input, parseInput);
  navigatePanel(page.state, url, historyIndex);
  page.apply(await requestFor(page.state.tabId, 'PANEL_SAVE', { state: page.state }), true);
}

window.addEventListener('message', event => {
  const page = [...pages.values()].find(
    page => page.started && event.source === page.web.contentWindow
  );
  if (
    !page ||
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
    if (
      page.disposed ||
      !page.state.url ||
      !page.started ||
      event.source !== page.web.contentWindow
    )
      return;
    page.viewport.accept(event.data, event.origin);
    if (event.data.type === 'POCKET_VIEWPORT') return;
    const metadata = page.tracker.accept(event.data);
    if (metadata) {
      page.title = metadata.title;
      page.titleUrl = metadata.pageUrl;
    }
    if (event.data.type === 'POCKET_LOCATION') {
      commitPanelNavigation(page.state, event.data.url, page.pendingNavigation);
      page.pendingNavigation = false;
      clearTimeout(page.loadingTimer);
      page.notice = '';
      // Hidden pages still report their own navigation; they cannot write another tab's state.
      page.state = await requestFor(page.state.tabId, 'PANEL_SAVE', { state: page.state });
      render(page);
    }
    if (
      metadata &&
      page.state.recentUrls.includes(metadata.url) &&
      page.state.recentTitles[metadata.url] !== metadata.title
    ) {
      const titles = await requestFor(page.state.tabId, 'PANEL_RECENT_TITLE', metadata);
      for (const cached of pages.values()) cached.state.recentTitles = titles;
      if (!active.disposed) recentMenu.render(active.state);
    }
    if (
      metadata &&
      page.state.favorites.some(
        item => item.url === metadata.pageUrl && item.title !== metadata.title
      )
    ) {
      setFavorites(
        await requestFor(page.state.tabId, 'PANEL_FAVORITE_TITLE', {
          url: metadata.pageUrl,
          title: metadata.title
        })
      );
    }
  });
});

element('#navigate').addEventListener('submit', event => {
  event.preventDefault();
  const input = address.value;
  const page = active;
  address.blur();
  recentMenu.hide();
  void serial(() => navigate(input, undefined, page));
});
element<HTMLButtonElement>('#reload').onclick = () => {
  if (active?.state.url) active.load(active.state.url);
};
element<HTMLButtonElement>('#back').onclick = () => {
  const page = active;
  const index = page.state.historyIndex - 1;
  if (index >= 0) void serial(() => navigate(page.state.history[index], index, page));
};
element<HTMLButtonElement>('#forward').onclick = () => {
  const page = active;
  const index = page.state.historyIndex + 1;
  if (index < page.state.history.length)
    void serial(() => navigate(page.state.history[index], index, page));
};
element('#mode').onclick = () => {
  if (active)
    void serial(async () =>
      setMode(
        await request('PANEL_MODE', {
          mode: active.state.mode === 'mobile' ? 'desktop' : 'mobile'
        })
      )
    );
};
element('#binding').onclick = () => {
  const page = active;
  const tabId = sourceTabId;
  if (!page || tabId === undefined || bindingBusy) return;
  bindingBusy = true;
  render();
  const bound = page.state.tabId === null;
  void serial(async () => {
    try {
      const next = await requestFor(page.state.tabId, 'PANEL_BIND', { sourceTabId: tabId, bound });
      if (bound) {
        // Bind the actual open document, including unsaved input and scroll position.
        // The shared slot is now empty; unbound tabs start from the welcome page.
        pages.delete(null);
        page.state = { ...page.state, tabId };
        pages.set(tabId, page);
        // Keep an empty shared slot immediately so a queued activation snapshot
        // from before the transfer cannot recreate the old shared document.
        pageFor({ ...next, tabId: null, url: '', history: [], historyIndex: -1 });
      } else {
        page.dispose();
        pages.delete(tabId);
      }
      select(next);
    } finally {
      bindingBusy = false;
      render();
    }
  });
};
function openCurrent() {
  emptyCurrent.disabled = true;
  const page = active;
  void serial(async () => {
    try {
      page.apply(await requestFor(page.state.tabId, 'PANEL_CURRENT'));
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
  const tabId = active.state.tabId;
  void serial(() => requestFor(tabId, 'PANEL_EXTERNAL'));
};
element<HTMLButtonElement>('#close-page').onclick = () => {
  const page = active;
  void serial(async () => {
    page.apply(await requestFor(page.state.tabId, 'PANEL_CLOSE'));
    recentMenu.hide();
    if (page === active) address.focus();
  });
};
element('#favorite').onclick = () => {
  const page = active;
  const url = page.state.url;
  const saved = page.state.favorites.some(item => item.url === url);
  if (!url) return;
  void serial(async () => {
    const favorites = saved
      ? await requestFor(page.state.tabId, 'PANEL_REMOVE_FAVORITE', { url })
      : await requestFor(page.state.tabId, 'PANEL_ADD_FAVORITE', {
          url,
          title: page.titleUrl === url ? page.title : ''
        });
    setFavorites(favorites);
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
window.addEventListener('blur', () => moreMenu.hidePopover());
retry.onclick = () => {
  void serial(async () => {
    select(await request('PANEL_READY'));
    if (active.state.url) active.load(active.state.url);
    connect();
  });
};
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
  select(await request('PANEL_READY'));
  connect();
});
