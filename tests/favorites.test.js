import test from 'node:test';
import assert from 'node:assert/strict';
import {
  favoriteLabel,
  favoriteUrl,
  moveFavorite,
  restoreFavorites,
  updateFavorite
} from '../src/favorites.ts';

test('favorite URL edits normalize addresses without accepting search text or privileged schemes', () => {
  assert.equal(
    favoriteUrl(' example.com/docs?q=1#section '),
    'https://example.com/docs?q=1#section'
  );
  assert.equal(favoriteUrl('HTTP://EXAMPLE.COM'), 'http://example.com/');
  for (const value of [
    '',
    'search words',
    'javascript:alert(1)',
    'chrome://settings',
    'file:///tmp/a',
    'https://',
    'https://a.example/\npath',
    null
  ]) {
    assert.throws(() => favoriteUrl(value), { code: 'errorFavoriteUrl' });
  }
});

test('editing a favorite replaces name and address at the same position without carrying old page metadata', () => {
  const original = [
    { url: 'https://a.example/', title: 'Page A' },
    { url: 'https://b.example/', title: 'Page B', customTitle: 'My B' },
    { url: 'https://c.example/', title: 'Page C' }
  ];
  const updated = updateFavorite(
    original,
    'https://b.example/',
    'new.example/path',
    ' New\n name '
  );
  assert.deepEqual(updated, [
    original[0],
    { url: 'https://new.example/path', title: '', customTitle: 'New name' },
    original[2]
  ]);
  assert.equal(original[1].url, 'https://b.example/');
  assert.equal(updated[0], original[0]);
  assert.equal(
    updateFavorite(original, 'https://b.example/', 'https://b.example/', 'My B'),
    original
  );
  assert.equal(
    updateFavorite(original, 'https://b.example/', 'https://b.example/', 'Renamed')[1].title,
    'Page B'
  );
  assert.throws(
    () => updateFavorite(original, 'https://b.example/', 'https://A.EXAMPLE', 'Duplicate'),
    { code: 'errorFavoriteDuplicate' }
  );
  assert.throws(() => updateFavorite(original, 'https://removed.example/', 'new.example', 'Late'), {
    code: 'errorFavoriteMissing'
  });
  assert.throws(() => updateFavorite(original, 'https://b.example/', 'new.example', '  '), {
    code: 'errorFavoriteName'
  });
});

test('favorites restore custom names and manual order while retaining legacy entries', () => {
  const restored = restoreFavorites([
    { url: 'https://b.example/', title: 'Page B', customTitle: ' My\n reference ' },
    { url: 'https://a.example/', title: 'Page A' },
    { url: 'https://c.example/', title: '', customTitle: 42 },
    { url: 'https://d.example/', title: '', customTitle: 'x'.repeat(600) }
  ]);
  assert.deepEqual(restored.slice(0, 3), [
    { url: 'https://b.example/', title: 'Page B', customTitle: 'My reference' },
    { url: 'https://a.example/', title: 'Page A' },
    { url: 'https://c.example/', title: '' }
  ]);
  assert.deepEqual(restored.slice(0, 3).map(favoriteLabel), [
    'My reference',
    'Page A',
    'c.example'
  ]);
  assert.equal(restored[3].customTitle.length, 512);
});

test('relative favorite moves preserve objects and skip invalid or unchanged destinations', () => {
  const favorites = ['a', 'b', 'c'].map(name => ({ url: `https://${name}.example/`, title: name }));
  const [a, b, c] = favorites.map(item => item.url);
  const next = moveFavorite(favorites, a, c, 'after');
  assert.deepEqual(next, [favorites[1], favorites[2], favorites[0]]);
  assert.equal(next[2], favorites[0]);
  assert.deepEqual(
    favorites.map(item => item.url),
    [a, b, c]
  );
  assert.deepEqual(moveFavorite(next, a, b, 'before'), favorites);
  for (const [source, target, position] of [
    [a, a, 'before'],
    [a, b, 'before'],
    [b, a, 'after'],
    ['missing', a, 'before'],
    [a, 'missing', 'before'],
    [a, c, 'invalid']
  ])
    assert.equal(moveFavorite(favorites, source, target, position), favorites);
});
