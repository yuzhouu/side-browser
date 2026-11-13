import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanelClient } from '../src/panel-client.ts';

function runtime(context, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  globalThis.chrome = { runtime: value };
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else delete globalThis.chrome;
  });
}

const noReceiver = 'Could not establish connection. Receiving end does not exist.';

function fakePort() {
  const listeners = {};
  return {
    onMessage: { addListener: listener => (listeners.message = listener) },
    onDisconnect: { addListener: listener => (listeners.disconnect = listener) },
    listeners
  };
}

test('opening the panel connects before requesting state and recovers from a missing receiver', async context => {
  const port = fakePort();
  const received = [];
  const sent = [];
  const delays = [];
  let connections = 0;
  const state = { url: 'https://example.com/' };
  runtime(context, {
    connect() {
      connections++;
      return port;
    },
    async sendMessage(message) {
      assert.equal(connections, 1);
      sent.push(message);
      if (sent.length === 1) throw new Error(noReceiver);
      return { ok: true, data: state };
    }
  });
  context.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    delays.push(delay);
    callback();
  });
  const client = createPanelClient(7, message => received.push(message));
  assert.deepEqual(await client.start(), state);
  assert.deepEqual(sent, [
    { type: 'PANEL_READY', windowId: 7 },
    { type: 'PANEL_READY', windowId: 7 }
  ]);
  assert.deepEqual(delays, [250]);
  // Manually retrying initialization reuses the existing port.
  assert.deepEqual(await client.start(), state);
  port.listeners.message({ type: 'connected', state });
  assert.deepEqual(received, [{ type: 'connected', state }]);
});

test('persistent startup failure is bounded and leaves reconnection active for later recovery', async context => {
  const ports = [];
  const received = [];
  const delays = [];
  let requests = 0;
  let lastErrorRead = 0;
  runtime(context, {
    connect() {
      const port = fakePort();
      ports.push(port);
      return port;
    },
    async sendMessage() {
      requests++;
      throw new Error(noReceiver);
    },
    get lastError() {
      lastErrorRead++;
      return { message: noReceiver };
    }
  });
  context.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    delays.push(delay);
    callback();
  });
  const client = createPanelClient(7, message => received.push(message));
  await assert.rejects(client.start(), { code: 'errorBackgroundUnavailable' });
  assert.equal(requests, 3);
  assert.deepEqual(delays, [250, 500]);
  assert.equal(ports.length, 1);
  ports[0].listeners.disconnect();
  assert.equal(lastErrorRead, 1);
  assert.equal(ports.length, 2);
  const message = { type: 'connected', state: { url: 'https://example.com/' } };
  ports[1].listeners.message(message);
  assert.deepEqual(received, [message]);
});

test('a transport retry preserves the original target and navigation snapshot', async context => {
  const sent = [];
  let selected = 10;
  const state = { url: 'https://example.com/', history: ['https://example.com/'] };
  runtime(context, {
    async sendMessage(message) {
      sent.push(structuredClone(message));
      if (sent.length === 1) throw new Error(noReceiver);
      return { ok: true, data: message.state };
    }
  });
  context.mock.method(globalThis, 'setTimeout', callback => {
    selected = 11;
    state.url = 'https://example.com/next';
    state.history.push(state.url);
    callback();
  });
  const client = createPanelClient(
    7,
    () => {},
    () => selected
  );
  await client.request('PANEL_SAVE', { state });
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[1], sent[0]);
  assert.equal(sent[1].tabId, 10);
  assert.deepEqual(sent[1].state, {
    url: 'https://example.com/',
    history: ['https://example.com/']
  });
});

test('requests with an unknown delivery outcome or an application error are never replayed', async context => {
  context.mock.method(globalThis, 'setTimeout', () => assert.fail('Unexpected retry'));
  for (const failure of [
    new Error('The message port closed before a response was received.'),
    new Error('Extension context invalidated.'),
    new Error('Unexpected browser error')
  ]) {
    let requests = 0;
    runtime(context, {
      async sendMessage() {
        requests++;
        throw failure;
      }
    });
    const client = createPanelClient(7, () => {});
    await assert.rejects(
      client.request('PANEL_OPEN_TAB', { url: 'https://example.com/' }),
      error => error === failure
    );
    assert.equal(requests, 1);
  }
  let requests = 0;
  runtime(context, {
    async sendMessage() {
      requests++;
      // Even the same text in an application response means the request was received.
      return { ok: false, error: noReceiver, errorCode: 'errorCurrentPage' };
    }
  });
  const client = createPanelClient(7, () => {});
  await assert.rejects(client.request('PANEL_CURRENT'), { code: 'errorCurrentPage' });
  assert.equal(requests, 1);
});

test('panel requests keep window routing and serialized error codes', async context => {
  let response = { ok: true, data: { url: 'https://example.com/' } };
  const sent = [];
  runtime(context, {
    async sendMessage(message) {
      sent.push(message);
      return response;
    }
  });
  const client = createPanelClient(7, () => {});
  assert.deepEqual(await client.request('PANEL_NAVIGATE', { input: 'example.com' }), response.data);
  assert.deepEqual(sent, [{ type: 'PANEL_NAVIGATE', windowId: 7, input: 'example.com' }]);
  response = { ok: false, error: 'Unsupported URL', errorCode: 'errorUnsupportedUrl' };
  await assert.rejects(client.request('PANEL_NAVIGATE'), {
    code: 'errorUnsupportedUrl',
    message: 'Unsupported URL'
  });
  response = undefined;
  await assert.rejects(client.request('PANEL_READY'), { code: 'errorExtensionUnavailable' });
});

test('worker disconnect reconnects one port and keeps delivering state to the existing panel', context => {
  const ports = [];
  const timers = [];
  const received = [];
  let lastErrorRead = 0;
  runtime(context, {
    connect(options) {
      assert.equal(options.name, 'pocket-sidepanel:7');
      const listeners = {};
      const port = {
        onMessage: {
          addListener: listener => {
            listeners.message = listener;
          }
        },
        onDisconnect: {
          addListener: listener => {
            listeners.disconnect = listener;
          }
        },
        listeners
      };
      ports.push(port);
      return port;
    },
    get lastError() {
      lastErrorRead++;
      return { message: 'Worker stopped' };
    }
  });
  context.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    assert.equal(delay, 250);
    timers.push(callback);
  });
  const client = createPanelClient(7, message => received.push(message));
  client.connect();
  client.connect();
  assert.equal(ports.length, 1);
  ports[0].listeners.message({ type: 'connected' });
  ports[0].listeners.disconnect();
  assert.equal(lastErrorRead, 1);
  client.connect();
  timers[0]();
  assert.equal(ports.length, 2);
  ports[1].listeners.message({ type: 'recent', urls: [] });
  assert.deepEqual(received, [{ type: 'connected' }, { type: 'recent', urls: [] }]);
});

test('repeated missing ports back off and a successful connection resets the delay', context => {
  const ports = [];
  const timers = [];
  runtime(context, {
    connect() {
      const port = fakePort();
      ports.push(port);
      return port;
    }
  });
  context.mock.method(globalThis, 'setTimeout', (callback, delay) =>
    timers.push({ callback, delay })
  );
  const client = createPanelClient(7, () => {});
  client.connect();
  for (let i = 0; i < 7; i++) {
    ports.at(-1).listeners.disconnect();
    timers.at(-1).callback();
  }
  assert.deepEqual(
    timers.map(timer => timer.delay),
    [250, 500, 1000, 2000, 4000, 5000, 5000]
  );
  ports.at(-1).listeners.message({ type: 'connected' });
  ports.at(-1).listeners.disconnect();
  assert.equal(timers.at(-1).delay, 250);
});

test('page requests capture their tab target and hidden pages use their own explicit target', async context => {
  const sent = [];
  runtime(context, {
    sendMessage: async message => {
      sent.push(message);
      return { ok: true, data: {} };
    }
  });
  let selected = 10;
  const client = createPanelClient(
    7,
    () => {},
    () => selected
  );
  const pending = client.request('PANEL_NAVIGATE', { input: 'https://example.com/' });
  selected = 11;
  await pending;
  await client.requestFor(10, 'PANEL_SAVE', { state: { url: 'https://example.com/next' } });
  await client.request('PANEL_CLOSE');
  await client.requestFor(null, 'PANEL_SAVE', { state: {} });
  assert.deepEqual(
    sent.map(({ windowId, tabId }) => ({ windowId, tabId })),
    [
      { windowId: 7, tabId: 10 },
      { windowId: 7, tabId: 10 },
      { windowId: 7, tabId: 11 },
      { windowId: 7, tabId: null }
    ]
  );
});
