import test from 'node:test';
import assert from 'node:assert/strict';
import { rankSuggestions, querySuggestions } from '../src/address-suggestions.ts';

const recent = (url, title = '') => ({ url, title, source: 'suggestionRecent' });
test('suggestions canonicalize duplicate URLs, combine sources, preserve paths and reject privileged URLs', () => {
  const items = rankSuggestions('', [
    recent('https://example.com'),
    { url: 'https://example.com/', title: 'Example', source: 'suggestionBookmark' },
    recent('https://example.com/other'),
    recent('chrome://settings'),
    recent('javascript:alert(1)'),
    recent('file:///tmp/secret'),
    recent('invalid'),
    { title: 'Bookmark folder', source: 'suggestionBookmark' }
  ]);
  assert.deepEqual(items, [
    {
      url: 'https://example.com/',
      title: 'Example',
      sources: ['suggestionRecent', 'suggestionBookmark']
    },
    { url: 'https://example.com/other', title: '', sources: ['suggestionRecent'] }
  ]);
});
test('matches titles and decoded URLs case-insensitively, ranks hosts ahead of title matches, and bounds results', () => {
  assert.deepEqual(
    rankSuggestions('EXAMPLE', [
      recent('https://else.test/', 'Example docs'),
      recent('https://www.example.com/')
    ]).map(x => x.url),
    ['https://www.example.com/', 'https://else.test/']
  );
  assert.equal(
    rankSuggestions('资料 guide', [recent('https://example.com/%E8%B5%84%E6%96%99', 'Guide')])
      .length,
    1
  );
  assert.equal(rankSuggestions('missing', [recent('https://example.com/')]).length, 0);
  assert.equal(
    rankSuggestions(
      '',
      Array.from({ length: 15 }, (_, i) => recent(`https://example.com/${i}`))
    ).length,
    8
  );
});
test('queries browser sources only for nonempty input, uses all history dates, and survives partial API failure', async context => {
  const previous = globalThis.chrome;
  context.after(() => {
    if (previous) globalThis.chrome = previous;
    else delete globalThis.chrome;
  });
  let historyCalls = 0;
  let bookmarkCalls = 0;
  globalThis.chrome = {
    history: {
      search: async query => {
        historyCalls++;
        assert.deepEqual(query, { text: 'example', startTime: 0, maxResults: 100 });
        throw new Error('unavailable');
      }
    },
    bookmarks: {
      search: async text => {
        bookmarkCalls++;
        assert.equal(text, 'example');
        return [{ url: 'https://example.com/bookmark', title: 'Saved' }];
      }
    }
  };
  const state = {
    recentUrls: ['https://example.com/recent'],
    recentTitles: {},
    favorites: [{ url: 'https://example.com/favorite', title: 'Favorite' }]
  };
  assert.equal((await querySuggestions('', state)).length, 2);
  assert.equal(historyCalls + bookmarkCalls, 0);
  assert.equal((await querySuggestions(' example ', state)).length, 3);
  assert.equal(historyCalls, 1);
  delete globalThis.chrome.bookmarks;
  assert.equal((await querySuggestions('example', state)).length, 2);
});

test('search action stays first without matches, supports URL text, and does not appear for empty input', async () => {
  const { withSearchSuggestion } = await import('../src/address-suggestions.ts');
  const result = withSearchSuggestion(' https://example.com/ ', 'bing', []);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://www.bing.com/search?q=https%3A%2F%2Fexample.com%2F');
  assert.deepEqual(result[0].search, { text: 'https://example.com/', engine: 'bing' });
  assert.deepEqual(withSearchSuggestion('  ', 'bing', []), []);
  assert.equal(
    withSearchSuggestion(
      'test',
      'baidu',
      Array.from({ length: 10 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: '',
        sources: []
      }))
    ).length,
    8
  );
});
