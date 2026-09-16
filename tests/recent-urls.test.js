import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreRecentUrls, rememberRecentUrl } from '../recent-urls.js';

test('recent addresses retain only the last ten unique explicit destinations', () => {
  let urls = [];
  for (let i = 0; i < 12; i++) urls = rememberRecentUrl(urls, `https://example.com/${i}`);
  assert.deepEqual(urls, Array.from({ length: 10 }, (_, i) => `https://example.com/${11 - i}`));
  urls = rememberRecentUrl(urls, 'https://example.com/5');
  assert.equal(urls[0], 'https://example.com/5');
  assert.equal(urls.length, 10);
  assert.equal(new Set(urls).size, 10);
});

test('restoring recent addresses validates and canonicalizes stored URLs without seeding history', () => {
  assert.deepEqual(restoreRecentUrls(undefined), []);
  assert.deepEqual(restoreRecentUrls({ history: ['https://old.example/'] }), []);
  assert.deepEqual(restoreRecentUrls([null, {}, 'https://', 'javascript:alert(1)', 'chrome://settings',
    'HTTPS://EXAMPLE.COM', 'https://example.com/', 'https://example.com/path#section']),
  ['https://example.com/', 'https://example.com/path#section']);
});
