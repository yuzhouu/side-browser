import type { PanelState } from './types.js';
import { isWebUrl, validMode } from './config.js';
import { userError } from './errors.js';

export const LAST_KEY = 'pocket-sidepanel-last-v1';
export const WINDOWS_KEY = 'pocket-sidepanel-windows-v1';
export const MODE_KEY = 'pocket-sidepanel-mode-v1';
const HISTORY_LIMIT = 100;

export function restorePanel(value: unknown = {}): PanelState {
  const stored = (value && typeof value === 'object' ? value : {}) as Partial<PanelState>;
  const history = Array.isArray(stored.history)
    ? stored.history.filter(isWebUrl).slice(-HISTORY_LIMIT)
    : [];
  const url = isWebUrl(stored.url) ? stored.url : '';
  let historyIndex =
    typeof stored.historyIndex === 'number' && Number.isInteger(stored.historyIndex)
      ? stored.historyIndex
      : history.length - 1;
  if (history[historyIndex] !== url) {
    historyIndex = history.lastIndexOf(url);
    if (url && historyIndex < 0) {
      history.push(url);
      if (history.length > HISTORY_LIMIT) history.shift();
      historyIndex = history.length - 1;
    }
  }
  return { url, mode: validMode(stored.mode), history, historyIndex };
}

export function navigatePanel(state: PanelState, url: string, historyIndex?: number) {
  if (!isWebUrl(url)) throw userError('errorUnsupportedUrl');
  if (
    typeof historyIndex === 'number' &&
    Number.isInteger(historyIndex) &&
    state.history[historyIndex] === url
  ) {
    state.historyIndex = historyIndex;
  } else if (state.history[state.historyIndex] !== url) {
    state.history = [...state.history.slice(0, state.historyIndex + 1), url].slice(-HISTORY_LIMIT);
    state.historyIndex = state.history.length - 1;
  }
  state.url = url;
}

export function commitPanelNavigation(state: PanelState, url: string, replace = false) {
  if (replace && state.historyIndex >= 0) {
    state.url = url;
    state.history[state.historyIndex] = url;
  } else navigatePanel(state, url);
}
