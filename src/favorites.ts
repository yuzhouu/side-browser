import type { Favorite } from './types.js';
import { normalizeRecentTitle } from './recent-urls.js';
import { parseInput } from './config.js';
import { userError } from './errors.js';

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
      const customTitle = normalizeRecentTitle(entry.customTitle);
      favorites.push({
        url: url.href,
        title: normalizeRecentTitle(entry.title),
        ...(customTitle ? { customTitle } : {})
      });
    } catch {
      /* Ignore invalid stored entries. */
    }
  }
  return favorites;
}

export const favoriteLabel = (favorite: Favorite) =>
  favorite.customTitle || favorite.title || new URL(favorite.url).host;

export function favoriteUrl(input: unknown) {
  if (typeof input !== 'string') throw userError('errorFavoriteUrl');
  try {
    const parsed = parseInput(input);
    if (parsed.kind === 'url') return parsed.url;
  } catch {
    // Editing a saved address never turns invalid input into a search.
  }
  throw userError('errorFavoriteUrl');
}

// Replace one entry atomically, retaining its position in the latest shared list.
export function updateFavorite(
  favorites: Favorite[],
  url: string,
  inputUrl: string,
  title: string
) {
  const newUrl = favoriteUrl(inputUrl);
  const customTitle = normalizeRecentTitle(title);
  if (!customTitle) throw userError('errorFavoriteName');
  const source = favorites.find(item => item.url === url);
  if (!source) throw userError('errorFavoriteMissing');
  if (favorites.some(item => item !== source && item.url === newUrl))
    throw userError('errorFavoriteDuplicate');
  if (newUrl === url && source.customTitle === customTitle) return favorites;
  return favorites.map(item =>
    item === source
      ? {
          url: newUrl,
          title: newUrl === url ? source.title : '',
          customTitle
        }
      : item
  );
}

// Apply a relative move to the latest list, preserving concurrent additions and edits.
export function moveFavorite(
  favorites: Favorite[],
  url: string,
  targetUrl: string,
  position: 'before' | 'after'
) {
  const source = favorites.find(item => item.url === url);
  if (
    !source ||
    url === targetUrl ||
    !favorites.some(item => item.url === targetUrl) ||
    !['before', 'after'].includes(position)
  )
    return favorites;
  const next = favorites.filter(item => item !== source);
  const target = next.findIndex(item => item.url === targetUrl);
  next.splice(target + (position === 'after' ? 1 : 0), 0, source);
  return next.every((item, index) => item === favorites[index]) ? favorites : next;
}
