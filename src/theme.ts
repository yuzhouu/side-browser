import { THEME_KEY, validTheme } from './theme-preference.js';

const apply = (value: unknown) => {
  const theme = validTheme(value);
  document.documentElement.dataset.theme = theme;
  for (const button of document.querySelectorAll<HTMLElement>('[data-theme-value]'))
    button.setAttribute('aria-pressed', String(button.dataset.themeValue === theme));
};

// Listen before reading so a late startup read cannot replace a newer preference.
let changed = false;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(THEME_KEY in changes)) return;
  changed = true;
  apply(changes[THEME_KEY].newValue);
});
void chrome.storage.local.get(THEME_KEY).then(
  values => {
    if (!changed) apply(values[THEME_KEY]);
  },
  error => console.error('[SideBrowser] Read appearance preference', error)
);
