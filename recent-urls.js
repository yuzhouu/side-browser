export const RECENT_KEY = 'pocket-sidepanel-recent-v1';
export const RECENT_TITLES_KEY = 'pocket-sidepanel-recent-titles-v1';
export const RECENT_LIMIT = 10;

export const normalizeRecentTitle = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 512) : '';

export function restoreRecentTitles(stored, urls) {
  return Object.fromEntries(urls.flatMap(url => {
    const title = normalizeRecentTitle(stored?.[url]);
    return title ? [[url, title]] : [];
  }));
}

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

export function recentFaviconUrl(pageUrl, extensionRoot) {
  const url = new URL('_favicon/', extensionRoot);
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.href;
}

// Bind the first loaded document (including HTTP redirects) to its open action.
// Later in-page navigations can only update a record for their own exact URL.
export class RecentTitleTracker {
  constructor() { this.entryUrl = ''; this.pageUrl = ''; this.documentId = null; this.pending = false; }
  navigate(url) { this.entryUrl = url; this.pending = true; }
  accept(data) {
    if (typeof data.documentId !== 'string' || !data.documentId) return null;
    if (data.type === 'POCKET_LOCATION') {
      if (this.pending) {
        if (data.documentId === this.documentId) return null;
        this.pending = false;
      } else if (data.url !== this.pageUrl || data.documentId !== this.documentId) this.entryUrl = data.url;
      this.pageUrl = data.url; this.documentId = data.documentId;
    } else if (data.type !== 'POCKET_TITLE' || this.pending || data.documentId !== this.documentId || data.url !== this.pageUrl) return null;
    const title = normalizeRecentTitle(data.title);
    return title && this.entryUrl ? { url: this.entryUrl, pageUrl: data.url, title } : null;
  }
}
