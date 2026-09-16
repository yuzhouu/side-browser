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
