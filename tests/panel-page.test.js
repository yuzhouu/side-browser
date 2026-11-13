import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelPage } from '../src/panel-page.ts';
import { restorePanel } from '../src/sidepanel-state.ts';

const a = 'https://a.example/';
const b = 'https://b.example/';

function setup(context) {
  const globals = ['chrome', 'ResizeObserver'].map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]);
  globalThis.chrome = { i18n: { getMessage: key => key } };
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  context.after(() => {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  let time = 0;
  let timerId = 0;
  const timers = new Map();
  context.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    timers.set(++timerId, { callback, due: time + delay });
    return timerId;
  });
  context.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const advance = elapsed => {
    const end = time + elapsed;
    for (;;) {
      const next = [...timers]
        .filter(([, timer]) => timer.due <= end)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      const [id, timer] = next;
      time = timer.due;
      timers.delete(id);
      timer.callback();
    }
    time = end;
  };
  const create = (tabId = null) => {
    const events = new Map();
    const attributes = new Map();
    const web = {
      style: {},
      src: '',
      addEventListener: (type, listener) => events.set(type, listener),
      remove() {},
      removeAttribute(name) {
        if (name === 'src') this.src = '';
      }
    };
    const stage = {
      hidden: false,
      style: {},
      parentElement: { clientWidth: 360, clientHeight: 800 },
      querySelector: () => web,
      setAttribute: (name, value) => attributes.set(name, value),
      append() {},
      remove() {}
    };
    const changes = [];
    const page = new PanelPage(
      stage,
      {
        ...restorePanel(),
        tabId,
        defaultMode: 'desktop',
        sitePreferences: {},
        requestMobile: false,
        searchEngine: 'google',
        customSearchEngine: null,
        recentUrls: [],
        recentTitles: {},
        favorites: []
      },
      page => changes.push({ loading: page.loading, notice: page.notice })
    );
    return { page, web, stage, changes, attributes, load: () => events.get('load')() };
  };
  return { create, advance };
}

test('loading lasts beyond document-start reports, shows a slow notice and ends on iframe completion', context => {
  const { create, advance } = setup(context);
  const { page, load, attributes } = create();
  page.apply({ ...page.state, url: a });
  assert.equal(page.loading, true);
  assert.equal(attributes.get('aria-busy'), 'true');
  page.reported('document-a');
  advance(11999);
  assert.equal(page.loading, true);
  assert.equal(page.notice, '');
  advance(1);
  assert.equal(page.notice, 'loadingSlow');
  page.reported('document-a');
  assert.equal(page.notice, 'loadingSlow');
  load();
  assert.equal(page.loading, false);
  assert.equal(attributes.get('aria-busy'), 'false');
  assert.equal(page.notice, '');
  advance(500);
  assert.equal(page.refused, false);
  page.reported('document-a');
  advance(12000);
  assert.equal(page.loading, false, 'same-document location changes do not start loading');
  assert.equal(page.notice, '');
});

test('in-frame navigation starts loading and ignores completion from stale documents', context => {
  const { create, advance } = setup(context);
  const { page, load, changes } = create();
  page.load(a);
  page.reported('document-a');
  load();
  advance(500);
  page.leaving(b, 'stale');
  assert.equal(page.loading, false);
  page.leaving(b, 'document-a');
  assert.equal(changes.at(-1).loading, true);
  assert.equal(page.target, b);
  advance(12000);
  assert.equal(page.notice, 'loadingSlow');
  page.reported('document-b');
  page.loaded('document-a');
  assert.equal(page.loading, true);
  // pageshow also finishes a restored document, without needing an iframe load event.
  page.loaded('document-b');
  assert.equal(page.loading, false);
  assert.equal(page.notice, '');
  page.leaving(a, 'document-b');
  assert.equal(page.loading, true);
  // An aborted or intercepted navigation finishes in the same document.
  page.loaded('document-b');
  assert.equal(page.loading, false);
  assert.equal(page.target, '');
  advance(12000);
  assert.equal(page.notice, '');
  page.load(a);
  page.loaded('document-b');
  page.leaving(b, 'document-b');
  assert.equal(page.loading, true, 'old completion cannot end a newer explicit navigation');
  assert.equal(page.target, a);
  page.reported('document-a-restored');
  page.loaded('document-a-restored');
  assert.equal(page.loading, false);
});

test('failed loads stop the indicator and retain the refused-page notice and destination', context => {
  const { create, advance } = setup(context);
  const { page, load } = create();
  page.load(a);
  load();
  assert.equal(page.loading, false);
  advance(500);
  assert.equal(page.refused, true);
  assert.equal(page.notice, 'pageRefused');
  assert.equal(page.target, a);
  advance(12000);
  assert.equal(page.notice, 'pageRefused');
  page.load(b);
  assert.equal(page.loading, true);
  assert.equal(page.refused, false);
  assert.equal(page.notice, '');
  load();
  advance(499);
  page.reported('document-b');
  advance(1);
  assert.equal(page.refused, false, 'late location reports still prevent false refusal notices');
});

test('hidden pages retain independent loading state and closing or disposing cancels their timers', context => {
  const { create, advance } = setup(context);
  const shared = create();
  const bound = create(10);
  shared.page.apply({ ...shared.page.state, url: a });
  bound.page.apply({ ...bound.page.state, url: b });
  shared.stage.hidden = true;
  bound.page.reported('bound');
  bound.load();
  advance(500);
  assert.equal(shared.page.loading, true);
  assert.equal(bound.page.loading, false);
  shared.page.apply({ ...shared.page.state });
  assert.equal(shared.page.loading, true);
  assert.equal(shared.web.src, a);
  shared.page.apply({ ...shared.page.state, url: '' });
  const closedChanges = shared.changes.length;
  shared.load();
  advance(12000);
  assert.equal(shared.page.loading, false);
  assert.equal(shared.web.src, '');
  assert.equal(shared.page.notice, '');
  assert.equal(shared.changes.length, closedChanges);
  bound.page.load(b);
  bound.page.dispose();
  const disposedChanges = bound.changes.length;
  bound.load();
  bound.page.loaded('bound');
  bound.page.leaving(a, 'bound');
  advance(12000);
  assert.equal(bound.page.loading, false);
  assert.equal(bound.changes.length, disposedChanges);
});
