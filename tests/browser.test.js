import test from 'node:test';
import assert from 'node:assert/strict';
import { shortcutsUrl } from '../src/browser.ts';
import { mobileIdentity } from '../src/mobile-profile.ts';
import { panelRules } from '../src/network-rules.ts';

const chromeUA = 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36';
const edgeUA = `${chromeUA} Edg/149.0.3599.0`;

test('shortcut management opens the host browser settings despite the shared Chrome UA token', () => {
  assert.equal(shortcutsUrl(chromeUA), 'chrome://extensions/shortcuts');
  assert.equal(shortcutsUrl(edgeUA), 'edge://extensions/shortcuts');
});

test('Edge keeps the same scoped network rules and consistent mobile identity as Chrome', () => {
  const identity = mobileIdentity(edgeUA);
  assert.deepEqual(identity, mobileIdentity(chromeUA));
  assert.equal(identity.userAgentMetadata.fullVersion, '149.0.0.0');
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  for (const mode of ['desktop', 'mobile']) {
    assert.deepEqual(
      panelRules(extensionId, mode, edgeUA),
      panelRules(extensionId, mode, chromeUA)
    );
  }
});
