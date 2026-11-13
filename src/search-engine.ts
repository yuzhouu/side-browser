import type { CustomSearchEngine, SearchEngine } from './types.js';
import { userError } from './errors.js';

export const SEARCH_ENGINE_KEY = 'pocket-search-engine-v1';
export const CUSTOM_SEARCH_ENGINE_KEY = 'pocket-custom-search-engine-v1';
export const SEARCH_ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  baidu: { name: 'Baidu', url: 'https://www.baidu.com/s?wd=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  'yahoo-japan': { name: 'Yahoo! JAPAN', url: 'https://search.yahoo.co.jp/search?p=' }
} as const;

export function parseCustomSearchEngine(value: unknown): CustomSearchEngine {
  const candidate =
    value && typeof value === 'object' ? (value as Partial<CustomSearchEngine>) : {};
  const name = typeof candidate.name === 'string' ? candidate.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 80) throw userError('errorCustomSearchName');
  const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
  try {
    if (
      url.length > 4096 ||
      !url.includes('%s') ||
      !/^https?:\/\//i.test(url) ||
      /[\s\u0000-\u001f\u007f]/.test(url)
    )
      throw new Error();
    const parsed = new URL(url);
    if (parsed.username || parsed.password) throw new Error();
    // A query must never change the destination host or protocol.
    if (
      new URL(url.replaceAll('%s', 'sidebrowser-query')).origin !==
      new URL(url.replaceAll('%s', 'another-query')).origin
    )
      throw new Error();
  } catch {
    throw userError('errorCustomSearchUrl');
  }
  return { name, url };
}

export function restoreCustomSearchEngine(value: unknown): CustomSearchEngine | null {
  try {
    return parseCustomSearchEngine(value);
  } catch {
    return null;
  }
}

export function validSearchEngine(
  value: unknown,
  custom: CustomSearchEngine | null = null
): SearchEngine {
  if (value === 'custom' && custom) return 'custom';
  return typeof value === 'string' && Object.hasOwn(SEARCH_ENGINES, value)
    ? (value as SearchEngine)
    : 'google';
}

export function searchEngineDetails(
  engine: SearchEngine,
  custom: CustomSearchEngine | null = null
) {
  const selected = validSearchEngine(engine, custom);
  return selected === 'custom' ? custom! : SEARCH_ENGINES[selected];
}

export function searchUrl(
  text: string,
  engine: SearchEngine = 'google',
  custom: CustomSearchEngine | null = null
) {
  const query = encodeURIComponent(text.trim());
  const selected = validSearchEngine(engine, custom);
  return selected === 'custom'
    ? custom!.url.replaceAll('%s', query)
    : SEARCH_ENGINES[selected].url + query;
}
