import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreSitePreferences, siteHostname, sitePreference } from '../src/site-preferences.ts';
import { panelRules } from '../src/network-rules.ts';

test('site choices use the exact canonical hostname, ignoring scheme and port', () => {
  const preferences = { 'example.com': { mode: 'mobile', requestMobile: true } };
  assert.equal(siteHostname('http://EXAMPLE.com:8080/path'), 'example.com');
  assert.equal(siteHostname('javascript:alert(1)'), '');
  assert.equal(siteHostname('https://*/'), '');
  assert.equal(siteHostname('https://[::1]:8080/'), '[::1]');
  assert.equal(siteHostname('https://你好.com'), 'xn--6qq79v.com');
  assert.equal(
    sitePreference('http://example.com:8080/', 'desktop', preferences).requestMobile,
    true
  );
  assert.deepEqual(sitePreference('https://sub.example.com/', 'desktop', preferences), {
    mode: 'desktop',
    requestMobile: false
  });
  assert.deepEqual(sitePreference('https://constructor/', 'mobile', {}), {
    mode: 'mobile',
    requestMobile: false
  });
});

test('restoring site choices rejects malformed records and keeps full width on native identity', () => {
  assert.deepEqual(restoreSitePreferences(null), {});
  assert.deepEqual(
    restoreSitePreferences({
      'example.com': { mode: 'desktop', requestMobile: true },
      'mobile.example': { mode: 'mobile', requestMobile: true },
      '*': { mode: 'mobile', requestMobile: true },
      '': { mode: 'mobile', requestMobile: true },
      'bad/path': { mode: 'mobile', requestMobile: true },
      'bad.example': { mode: 'unknown', requestMobile: true },
      'bool.example': { mode: 'mobile', requestMobile: 'true' }
    }),
    {
      'example.com': { mode: 'desktop', requestMobile: false },
      'mobile.example': { mode: 'mobile', requestMobile: true }
    }
  );
});

test('default and saved narrow layouts install no identity overrides', () => {
  for (const preferences of [{}, { 'example.com': { mode: 'mobile', requestMobile: false } }]) {
    const rules = panelRules('extension', preferences, 'Unknown browser');
    assert.equal(rules.length, 2);
    assert(rules.every(rule => !rule.action.requestHeaders));
  }
});

test('mobile request rules are limited to explicit exact hostnames in the non-tab extension tree', () => {
  const rules = panelRules(
    'extension',
    {
      'example.com': { mode: 'mobile', requestMobile: true },
      'native.example': { mode: 'mobile', requestMobile: false }
    },
    'Chrome/149.0.0.0'
  ).filter(rule => rule.action.requestHeaders);
  assert.deepEqual(
    rules.map(rule => rule.condition),
    [
      { tabIds: [-1], topDomains: ['extension'], urlFilter: '|http://example.com^' },
      { tabIds: [-1], topDomains: ['extension'], urlFilter: '|https://example.com^' }
    ]
  );
});
