export const RECENT_KEY = 'pocket-sidepanel-recent-v1';
export const RECENT_LIMIT = 10;

export function restoreRecentUrls(stored) {
  const urls = [];
  for (const value of Array.isArray(stored) ? stored : []) {
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || urls.includes(url.href)) continue;
      urls.push(url.href);
      if (urls.length === RECENT_LIMIT) break;
    } catch { /* Ignore invalid stored entries. */ }
  }
  return urls;
}

// Call only for explicit open actions; navigation history is a separate store.
export function rememberRecentUrl(urls, url) {
  return restoreRecentUrls([url, ...urls]);
}
