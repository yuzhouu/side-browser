import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('document title mutations report metadata without creating location history events', () => {
  const messages = [],
    observers = [],
    listeners = {};
  const document = {
    title: 'Initial title',
    head: {},
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const context = {
    document,
    location: { href: 'https://example.com/', ancestorOrigins: ['chrome-extension://test'] },
    chrome: { runtime: { id: 'test' } },
    crypto: { getRandomValues: values => values.fill(1) },
    parent: { postMessage: value => messages.push(value) },
    top: {},
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target, options) {
        this.target = target;
        this.options = options;
      }
    }
  };
  context.window = context;
  runInNewContext(
    readFileSync(new URL('../dist/frame-navigation.js', import.meta.url), 'utf8'),
    context
  );
  assert.equal(messages[0].type, 'POCKET_LOCATION');
  assert.equal(messages[0].title, 'Initial title');
  assert.equal(observers[0].target, document.head);
  assert.equal(observers[0].options.characterData, true);
  document.title = 'Updated title';
  observers[0].callback();
  assert.deepEqual(
    messages.map(message => message.type),
    ['POCKET_LOCATION', 'POCKET_TITLE']
  );
  assert.equal(messages[1].title, 'Updated title');
  observers[0].callback();
  assert.equal(messages.length, 2);
  listeners.pageshow();
  assert.equal(messages.at(-1).title, 'Updated title');
  assert.equal(messages.at(-2).type, 'POCKET_LOCATION');
  assert.equal(messages.at(-1).type, 'POCKET_LOADED');
});

test('cross-document destinations are reported before leaving; same-document ones are not', () => {
  const messages = [],
    navigation = {};
  const context = {
    document: {
      title: '',
      readyState: 'complete',
      head: {},
      querySelectorAll: () => [],
      addEventListener() {}
    },
    location: { href: 'https://example.com/', ancestorOrigins: ['chrome-extension://test'] },
    chrome: { runtime: { id: 'test' } },
    crypto: { getRandomValues: values => values.fill(1) },
    parent: { postMessage: (value, origin) => messages.push({ ...value, origin }) },
    top: {},
    addEventListener() {},
    navigation: { addEventListener: (type, listener) => (navigation[type] = listener) },
    MutationObserver: class {
      observe() {}
    }
  };
  context.window = context;
  runInNewContext(
    readFileSync(new URL('../dist/frame-navigation.js', import.meta.url), 'utf8'),
    context
  );
  const navigate = (url, sameDocument, extra = {}) => {
    const controller = new AbortController();
    navigation.navigate({
      destination: { url, sameDocument },
      downloadRequest: null,
      signal: controller.signal,
      ...extra
    });
    return controller;
  };
  navigate('https://example.com/#section', true);
  navigate('blob:https://example.com/file', false);
  navigate('https://example.com/file', false, { downloadRequest: '' });
  navigate('https://example.com/prevented', false, { defaultPrevented: true });
  const pending = navigate('https://refused.example/page', false);
  const leaving = messages.filter(message => message.type === 'POCKET_LEAVING');
  assert.equal(leaving.length, 1);
  assert.equal(leaving[0].url, 'https://refused.example/page');
  assert.equal(leaving[0].origin, 'chrome-extension://test');
  pending.abort();
  assert.equal(messages.at(-1).type, 'POCKET_LOADED');
  // A stale cancellation cannot end the next navigation's loading state.
  const first = navigate('https://example.com/first', false);
  navigate('https://example.com/second', false);
  first.abort();
  assert.equal(messages.at(-1).type, 'POCKET_LEAVING');
  navigation.navigatesuccess();
  assert.equal(messages.at(-1).type, 'POCKET_LOADED');
});
