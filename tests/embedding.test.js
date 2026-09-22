import test from 'node:test';
import assert from 'node:assert/strict';
import { frameDestination } from '../src/embedding.ts';
import { parseInput } from '../src/config.ts';
test('embedded search stays in the iframe and rejects executable schemes', () => {
  assert.equal(
    frameDestination('测试 搜索', parseInput),
    'https://www.google.com/search?q=%E6%B5%8B%E8%AF%95%20%E6%90%9C%E7%B4%A2'
  );
  assert.equal(frameDestination('example.com', parseInput), 'https://example.com/');
  assert.throws(() => frameDestination('javascript:alert(1)', parseInput));
});

test('search destinations use the selected engine while URLs remain unchanged', () => {
  const text = '测试 & cats #?';
  for (const [engine, prefix] of Object.entries({
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    baidu: 'https://www.baidu.com/s?wd=',
    duckduckgo: 'https://duckduckgo.com/?q='
  })) {
    assert.equal(frameDestination(text, parseInput, engine), prefix + encodeURIComponent(text));
    assert.equal(
      frameDestination('example.com/docs', parseInput, engine),
      'https://example.com/docs'
    );
  }
  assert.equal(
    frameDestination('words', parseInput, 'unknown'),
    'https://www.google.com/search?q=words'
  );
});
