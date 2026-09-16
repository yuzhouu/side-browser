import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreRecentUrls, rememberRecentUrl, recentFaviconUrl, restoreRecentTitles, RecentTitleTracker } from '../recent-urls.js';
import { readFileSync } from 'node:fs';

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

test('favicon requests stay inside the extension and preserve the complete page URL as one parameter', () => {
  const pageUrl = 'https://example.com/路径?next=https%3A%2F%2Fother.example%2F&size=64#section';
  const icon = new URL(recentFaviconUrl(pageUrl, 'chrome-extension://test/'));
  assert.equal(icon.protocol, 'chrome-extension:');
  assert.equal(icon.host, 'test');
  assert.equal(icon.pathname, '/_favicon/');
  assert.equal(icon.searchParams.get('pageUrl'), pageUrl);
  assert.deepEqual(icon.searchParams.getAll('size'), ['32']);
  assert.equal(icon.hash, '');
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
  assert(manifest.permissions.includes('favicon'));
  assert.equal(manifest.web_accessible_resources, undefined);
});

test('title metadata is optional for old records, bounded and pruned to retained URLs', () => {
  const a = 'https://example.com/', b = 'https://example.com/path';
  assert.deepEqual(restoreRecentTitles(undefined, [a]), {});
  assert.deepEqual(restoreRecentTitles({ [a]: '  A\n  title  ', [b]: 'Removed page' }, [a]), { [a]: 'A title' });
  assert.deepEqual(restoreRecentTitles({ [a]: {}, [b]: '   ' }, [a, b]), {});
  assert.equal(restoreRecentTitles({ [a]: 'x'.repeat(1000) }, [a])[a].length, 512);
});

test('HTTP redirect title and later title changes stay associated with the explicit entry', () => {
  const tracker = new RecentTitleTracker();
  const entry = 'https://example.com/', final = 'https://www.example.com/';
  tracker.navigate(entry);
  const page = { url: final, documentId: 'first' };
  assert.equal(tracker.accept({ ...page, type: 'POCKET_LOCATION', title: '' }), null);
  assert.deepEqual(tracker.accept({ ...page, type: 'POCKET_TITLE', title: 'Loaded title' }), { url: entry, pageUrl: final, title: 'Loaded title' });
  assert.deepEqual(tracker.accept({ ...page, type: 'POCKET_TITLE', title: 'New title' }), { url: entry, pageUrl: final, title: 'New title' });
});

test('internal navigation titles never overwrite the original entry and old document reports are ignored', () => {
  const tracker = new RecentTitleTracker();
  const entry = 'https://example.com/', next = 'https://example.com/inside';
  tracker.navigate(entry);
  tracker.accept({ type: 'POCKET_LOCATION', url: entry, documentId: 'first', title: 'Home' });
  assert.deepEqual(tracker.accept({ type: 'POCKET_LOCATION', url: next, documentId: 'first', title: 'Inside' }), { url: next, pageUrl: next, title: 'Inside' });
  assert.equal(tracker.accept({ type: 'POCKET_TITLE', url: entry, documentId: 'first', title: 'Old URL' }), null);
  tracker.navigate(entry);
  assert.equal(tracker.accept({ type: 'POCKET_LOCATION', url: next, documentId: 'first', title: 'Old document' }), null);
  assert.equal(tracker.accept({ type: 'POCKET_TITLE', url: next, documentId: 'first', title: 'Old title' }), null);
  assert.deepEqual(tracker.accept({ type: 'POCKET_LOCATION', url: entry, documentId: 'second', title: 'Home again' }), { url: entry, pageUrl: entry, title: 'Home again' });
  assert.equal(tracker.accept({ type: 'POCKET_TITLE', url: entry, documentId: 'first', title: 'Outdated' }), null);
});
