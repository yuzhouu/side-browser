import { searchUrl } from './search-engine.js';
import type { SearchEngine, PanelSnapshot } from './types.js';

export type SuggestionSource =
  | 'suggestionRecent'
  | 'suggestionFavorite'
  | 'suggestionHistory'
  | 'suggestionBookmark';
export interface AddressSuggestion {
  url: string;
  title: string;
  sources: SuggestionSource[];
  search?: { text: string; engine: SearchEngine };
}
type Candidate = { url?: string; title?: string; source: SuggestionSource };
export type SuggestionState = Pick<PanelSnapshot, 'recentUrls' | 'recentTitles' | 'favorites'>;

export function rankSuggestions(query: string, candidates: Candidate[]): AddressSuggestion[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = new Map<string, AddressSuggestion>();
  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate.url || '');
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol)) continue;
    const title = candidate.title?.trim() || '';
    let decoded = url.href;
    try {
      decoded = decodeURI(decoded);
    } catch {
      /* Keep malformed escapes searchable as-is. */
    }
    const text = `${decoded} ${title}`.toLocaleLowerCase();
    if (!terms.every(term => text.includes(term))) continue;
    const existing = matches.get(url.href);
    if (existing) {
      if (!existing.sources.includes(candidate.source)) existing.sources.push(candidate.source);
      if (!existing.title) existing.title = title;
    } else matches.set(url.href, { url: url.href, title, sources: [candidate.source] });
  }
  const input = query.trim().toLocaleLowerCase();
  const score = (item: AddressSuggestion) => {
    const url = new URL(item.url);
    const host = url.host.toLocaleLowerCase().replace(/^www\./, '');
    if (!input) return 0;
    if (item.url.toLocaleLowerCase() === input || host === input) return 3;
    if (host.startsWith(input)) return 2;
    if (item.title.toLocaleLowerCase().startsWith(input)) return 1;
    return 0;
  };
  return [...matches.values()].sort((a, b) => score(b) - score(a)).slice(0, 8);
}

export function localCandidates(state?: SuggestionState): Candidate[] {
  return [
    ...(state?.recentUrls || []).map(url => ({
      url,
      title: state?.recentTitles[url],
      source: 'suggestionRecent' as const
    })),
    ...(state?.favorites || []).map(item => ({ ...item, source: 'suggestionFavorite' as const }))
  ];
}

export async function querySuggestions(
  query: string,
  state?: SuggestionState
): Promise<AddressSuggestion[]> {
  const candidates = localCandidates(state);
  const text = query.trim();
  if (!text) return rankSuggestions(text, candidates);
  // Query only while editing; never copy the browser's full history/bookmark library to storage.
  // Failure of one source must not suppress the other sources or normal navigation.
  const [history, bookmarks] = await Promise.allSettled([
    Promise.resolve().then(() => chrome.history.search({ text, startTime: 0, maxResults: 100 })),
    Promise.resolve().then(() => chrome.bookmarks.search(text))
  ]);
  if (history.status === 'fulfilled')
    candidates.push(
      ...history.value.map(item => ({ ...item, source: 'suggestionHistory' as const }))
    );
  if (bookmarks.status === 'fulfilled')
    candidates.push(
      ...bookmarks.value.map(item => ({ ...item, source: 'suggestionBookmark' as const }))
    );
  return rankSuggestions(text, candidates);
}

// Keep an explicit search action available even when the input resembles a URL.
export function withSearchSuggestion(
  query: string,
  engine: SearchEngine,
  items: AddressSuggestion[]
): AddressSuggestion[] {
  const text = query.trim();
  if (!text) return items;
  const url = searchUrl(text, engine);
  return [
    { url, title: '', sources: [], search: { text, engine } },
    ...items.filter(item => item.url !== url).slice(0, 7)
  ];
}
