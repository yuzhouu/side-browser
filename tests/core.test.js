import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, mobileIdentity } from '../config.js';

test('typed domains and URLs preserve paths, queries and fragments', () => {
  assert.deepEqual(parseInput(' example.com/a?q=中文#b '), {
    kind: 'url',
    url: 'https://example.com/a?q=%E4%B8%AD%E6%96%87#b'
  });
  assert.deepEqual(parseInput('http://example.com:8080/a'), {
    kind: 'url',
    url: 'http://example.com:8080/a'
  });
  assert.match(parseInput('例子.中国').url, /^https:\/\/xn--/);
});
test('localhost and loopback addresses use HTTP without losing their ports', () => {
  for (const value of ['localhost:3000/a', '127.0.0.1:8080', '[::1]:3000']) {
    assert.equal(parseInput(value).url, new URL(`http://${value}`).href);
  }
});
test('plain language and domain-like phrases stay search queries', () => {
  for (const text of ['今日天气', 'how does example.com work', 'Chrome 手机模式']) {
    assert.deepEqual(parseInput(text), { kind: 'search', text });
  }
  assert.deepEqual(parseInput('  '), { kind: 'home' });
});
test('executable and browser-internal schemes cannot be launched from input', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/a',
    'chrome://settings',
    'https://',
    'https://a.com/\npath'
  ]) {
    assert.throws(() => parseInput(value));
  }
});
test('mobile identity keeps the actual browser version and consistent device metadata', () => {
  const identity = mobileIdentity('Mozilla/5.0 Chrome/149.0.7827.55 Safari/537.36');
  assert.match(identity.userAgent, /Chrome\/149\.0\.7827\.55 Mobile/);
  assert.equal(identity.userAgentMetadata.mobile, true);
  assert.equal(identity.userAgentMetadata.platform, 'Android');
  assert.equal(identity.userAgentMetadata.brands[0].version, '149');
  assert.equal(identity.userAgentMetadata.fullVersionList[0].version, '149.0.7827.55');
  assert.throws(() => mobileIdentity('Unknown browser'));
});
