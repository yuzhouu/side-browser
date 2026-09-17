import type { Favorite } from './types.js';
import { normalizeRecentTitle } from './recent-urls.js';

export const FAVORITES_KEY = 'pocket-sidepanel-favorites-v1';

// Favorites are independent of navigation and the bounded recent list.
export function restoreFavorites(stored: unknown): Favorite[] {
  const favorites: Favorite[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(stored) ? stored : []) {
    if (!entry || typeof entry.url !== 'string') continue;
    try {
      const url = new URL(entry.url);
      if (!['http:', 'https:'].includes(url.protocol) || seen.has(url.href)) continue;
      seen.add(url.href);
      favorites.push({ url: url.href, title: normalizeRecentTitle(entry.title) });
    } catch {
      /* Ignore invalid stored entries. */
    }
  }
  return favorites;
}
