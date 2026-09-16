import test from 'node:test';
import assert from 'node:assert/strict';
import { panelRules } from '../src/network-rules.ts';
import fs from 'node:fs';

test('compatibility and mobile UA rules match only this extension non-tab tree, with framing limited to documents', () => {
  const rules = panelRules(
    'abcdefghijklmnopabcdefghijklmnop',
    'mobile',
    'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36'
  );
  assert.equal(rules.length, 3);
  for (const rule of rules) {
    assert.deepEqual(rule.condition.tabIds, [-1]);
    assert.deepEqual(rule.condition.topDomains, ['abcdefghijklmnopabcdefghijklmnop']);
    if (rule.action.responseHeaders) assert.deepEqual(rule.condition.resourceTypes, ['sub_frame']);
    else assert.equal(rule.condition.resourceTypes, undefined);
  }
  assert.deepEqual(rules[0].condition.resourceTypes, ['sub_frame']);
  assert.deepEqual(rules[1].condition.resourceTypes, ['sub_frame']);
  assert.deepEqual(rules[1].condition.responseHeaders, [
    { header: 'content-security-policy', values: ['*frame-ancestors*'] }
  ]);
});
test('desktop mode removes UA overrides instead of affecting the source page', () => {
  const rules = panelRules('abcdefghijklmnopabcdefghijklmnop', 'desktop', 'Chrome/149.0.0.0');
  assert.equal(
    rules.some(r => r.action.requestHeaders),
    false
  );
});
test('mobile document requests cannot retain desktop high-entropy device hints', () => {
  const rules = panelRules(
    'abcdefghijklmnopabcdefghijklmnop',
    'mobile',
    'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36'
  );
  const headers = Object.fromEntries(
    rules
      .find(rule => rule.action.requestHeaders)
      .action.requestHeaders.map(header => [header.header, header.value])
  );
  assert.match(headers['user-agent'], /Android 13; Pixel 7/);
  assert.equal(headers['sec-ch-ua-mobile'], '?1');
  assert.equal(headers['sec-ch-ua-platform'], '"Android"');
  assert.equal(headers['sec-ch-ua-platform-version'], '"13.0.0"');
  assert.equal(headers['sec-ch-ua-model'], '"Pixel 7"');
  assert.equal(headers['sec-ch-ua-arch'], '"arm"');
  assert.equal(headers['sec-ch-ua-bitness'], '"64"');
  assert.match(headers['sec-ch-ua-full-version-list'], /"Chromium";v="149.0.0.0"/);
});
test('the shipped manifest uses a global native side panel without a popup or injected overlay', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url)));
  assert(!manifest.permissions.includes('debugger'));
  assert(manifest.permissions.includes('declarativeNetRequestWithHostAccess'));
  assert(manifest.permissions.includes('sidePanel'));
  assert.equal(manifest.minimum_chrome_version, '145');
  assert.deepEqual(manifest.side_panel, { default_path: 'sidepanel.html' });
  assert.equal(manifest.action.default_popup, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.deepEqual(manifest.content_scripts[0].js, ['frame-navigation.js']);
  const background = fs.readFileSync(new URL('../src/background.ts', import.meta.url), 'utf8');
  assert(!/type:\s*['"]popup['"]/.test(background));
  assert(!background.includes('tabs.onActivated'));
  assert(!background.includes('tabs.onUpdated'));
  assert(!background.includes('sidePanel.setOptions'));
});
