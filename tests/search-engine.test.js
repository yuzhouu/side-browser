import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCustomSearchEngine,
  restoreCustomSearchEngine,
  searchEngineDetails,
  searchUrl,
  validSearchEngine
} from '../src/search-engine.ts';
import { frameDestination } from '../src/embedding.ts';
import { parseInput } from '../src/config.ts';
import { withSearchSuggestion } from '../src/address-suggestions.ts';

test('custom search preserves URL templates and encodes Japanese and reserved characters once', () => {
  const custom = parseCustomSearchEngine({
    name: '  My  search  ',
    url: ' https://example.com/find/%s?q=%s&lang=ja#results '
  });
  assert.equal(custom.name, 'My search');
  assert.equal(custom.url, 'https://example.com/find/%s?q=%s&lang=ja#results');
  const query = '日本語 & cats #? / + %s';
  const encoded = encodeURIComponent(query);
  const expected = `https://example.com/find/${encoded}?q=${encoded}&lang=ja#results`;
  assert.equal(searchUrl(` ${query} `, 'custom', custom), expected);
  assert.equal(frameDestination(query, parseInput, 'custom', custom), expected);
  assert.equal(withSearchSuggestion(query, 'custom', [], custom)[0].url, expected);
  assert.deepEqual(searchEngineDetails('custom', custom), custom);
  assert.equal(
    frameDestination('example.org/docs', parseInput, 'custom', custom),
    'https://example.org/docs'
  );
  assert.equal(
    withSearchSuggestion('example.org/docs', 'custom', [], custom)[0].url,
    'https://example.com/find/example.org%2Fdocs?q=example.org%2Fdocs&lang=ja#results'
  );
});

test('custom search rejects invalid names, executable URLs and placeholders in the origin', () => {
  const url = 'https://example.com/?q=%s';
  for (const name of [undefined, 42, '', '  ', 'x'.repeat(81)]) {
    assert.throws(() => parseCustomSearchEngine({ name, url }), { code: 'errorCustomSearchName' });
  }
  for (const invalid of [
    undefined,
    42,
    '',
    'example.com/?q=%s',
    'https://example.com/',
    'https://example.com/?q=%25s',
    'javascript:alert("%s")',
    'data:text/html,%s',
    'file:///tmp/%s',
    'chrome://settings/%s',
    'https://%s.example.com/search',
    'https://example.com:%s/search',
    'https://user:password@example.com/?q=%s',
    'https://example.com/\n?q=%s',
    'https://example.com/?q=%s hello',
    'https://example.com/?q=%s&long=' + 'a'.repeat(4096)
  ]) {
    assert.throws(() => parseCustomSearchEngine({ name: 'Test', url: invalid }), {
      code: 'errorCustomSearchUrl'
    });
    assert.equal(restoreCustomSearchEngine({ name: 'Test', url: invalid }), null);
  }
  assert.equal(
    parseCustomSearchEngine({ name: 'Local', url: 'http://localhost:8080/search?q=%s' }).url,
    'http://localhost:8080/search?q=%s'
  );
});

test('missing custom configuration falls back to Google and Yahoo Japan uses its Japanese endpoint', () => {
  assert.equal(restoreCustomSearchEngine(null), null);
  assert.equal(validSearchEngine('custom'), 'google');
  assert.equal(searchUrl('words', 'custom'), 'https://www.google.com/search?q=words');
  assert.equal(searchEngineDetails('custom').name, 'Google');
  assert.equal(validSearchEngine('yahoo-japan'), 'yahoo-japan');
  assert.equal(searchEngineDetails('yahoo-japan').name, 'Yahoo! JAPAN');
  assert.equal(
    searchUrl('日本 & 東京', 'yahoo-japan'),
    'https://search.yahoo.co.jp/search?p=' + encodeURIComponent('日本 & 東京')
  );
});
