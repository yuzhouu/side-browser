import type { SearchEngine } from './types.js';

export const SEARCH_ENGINE_KEY = 'pocket-search-engine-v1';
export const SEARCH_ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  baidu: { name: 'Baidu', url: 'https://www.baidu.com/s?wd=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' }
} as const;

export function validSearchEngine(value: unknown): SearchEngine {
  return typeof value === 'string' && Object.hasOwn(SEARCH_ENGINES, value)
    ? (value as SearchEngine)
    : 'google';
}

export function searchUrl(text: string, engine: SearchEngine = 'google') {
  return SEARCH_ENGINES[validSearchEngine(engine)].url + encodeURIComponent(text.trim());
}
