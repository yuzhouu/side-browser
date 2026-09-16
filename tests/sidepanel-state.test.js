import test from 'node:test';
import assert from 'node:assert/strict';
import { restorePanel, navigatePanel, commitPanelNavigation } from '../sidepanel-state.js';
const a = 'https://a.example/',
  b = 'https://b.example/',
  c = 'https://c.example/';
test('migrating overlay data retains URL/history/mode without carrying its page lifecycle', () => {
  assert.deepEqual(
    restorePanel({
      open: true,
      url: a,
      mode: 'desktop',
      history: [a, b],
      historyIndex: 0,
      collapsed: true
    }),
    { url: a, mode: 'desktop', history: [a, b], historyIndex: 0 }
  );
});
test('two window states are independent even when seeded from the same last URL', () => {
  const last = restorePanel({ url: a });
  const first = restorePanel(last),
    second = restorePanel(last);
  navigatePanel(first, b);
  assert.equal(second.url, a);
  assert.deepEqual(second.history, [a]);
  assert.equal(last.url, a);
});
test('back/forward survive restoration and a new destination discards the forward branch', () => {
  let state = restorePanel({ url: a });
  navigatePanel(state, b);
  navigatePanel(state, a, 0);
  state = restorePanel(JSON.parse(JSON.stringify(state)));
  assert.equal(state.historyIndex, 0);
  navigatePanel(state, c);
  assert.deepEqual(state.history, [a, c]);
});
test('redirects replace pending destinations, repeated reports do not duplicate history', () => {
  const state = restorePanel({ url: a });
  navigatePanel(state, b);
  commitPanelNavigation(state, c, true);
  commitPanelNavigation(state, c);
  assert.deepEqual(state.history, [a, c]);
  assert.equal(state.url, c);
});
test('stored privileged URLs are rejected and the history is bounded', () => {
  assert.equal(restorePanel({ url: 'javascript:alert(1)' }).url, '');
  const state = restorePanel();
  for (let i = 0; i < 120; i++) navigatePanel(state, `https://example.com/${i}`);
  assert.equal(state.history.length, 100);
  assert.equal(state.historyIndex, 99);
  const repaired = restorePanel({ ...state, url: a });
  assert.equal(repaired.history.length, 100);
  assert.equal(repaired.historyIndex, 99);
  assert.equal(repaired.history[99], a);
});
