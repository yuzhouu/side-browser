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
    readFileSync(new URL('../frame-navigation.js', import.meta.url), 'utf8'),
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
});
