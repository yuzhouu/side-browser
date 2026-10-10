import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { frameCookieUrl, scriptHiddenCookies } from '../src/frame-cookies.ts';

const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
const script = name => readFileSync(new URL(`../dist/${name}.js`, import.meta.url), 'utf8');

test('frame cookies are read only for the sender HTTPS origin', () => {
  const origin = 'https://example.com';
  assert.equal(
    frameCookieUrl('https://example.com/path?q=1', origin),
    'https://example.com/path?q=1'
  );
  assert.equal(frameCookieUrl('https://other.example/', origin), null);
  assert.equal(frameCookieUrl('https://sub.example.com/', origin), null);
  assert.equal(frameCookieUrl('http://example.com/', 'http://example.com'), null);
  assert.equal(frameCookieUrl('not a url', origin), null);
  assert.equal(frameCookieUrl(1, origin), null);
  assert.equal(frameCookieUrl('https://example.com/', undefined), null);
});

test('only script-readable cookies hidden by SameSite are supplied', () => {
  const cookie = (name, sameSite, extra = {}) => ({
    name,
    value: '1',
    sameSite,
    httpOnly: false,
    ...extra
  });
  assert.deepEqual(
    scriptHiddenCookies([
      cookie('lax', 'lax'),
      cookie('strict', 'strict'),
      cookie('default', 'unspecified'),
      cookie('none', 'no_restriction'),
      cookie('session', 'lax', { httpOnly: true }),
      cookie('partitioned', 'lax', { partitionKey: { topLevelSite: 'https://a.example' } }),
      cookie('', 'lax', { value: 'nameless' })
    ]),
    ['lax=1', 'strict=1', 'default=1', 'nameless']
  );
  assert.equal(
    scriptHiddenCookies(Array.from({ length: 300 }, (_, i) => cookie(`c${i}`, 'lax'))).length,
    180
  );
});

function mainWorld({ ancestorOrigins = [`chrome-extension://${extensionId}`], protocol } = {}) {
  let native = 'none=1',
    now = 0;
  const listeners = {},
    requests = [];
  class Document {}
  Object.defineProperty(Document.prototype, 'cookie', {
    configurable: true,
    enumerable: true,
    get() {
      return this === document ? native : '';
    },
    set(value) {
      native = value;
    }
  });
  const document = Object.create(Document.prototype);
  document.addEventListener = (type, listener) => (listeners[type] = listener);
  document.dispatchEvent = event => requests.push(event.type);
  const context = {
    Document,
    document,
    location: { protocol: protocol || 'https:', ancestorOrigins },
    top: {},
    performance: { now: () => now },
    Event: class {
      constructor(type) {
        this.type = type;
      }
    }
  };
  context.window = context;
  runInNewContext(script('frame-cookies-main'), context);
  return {
    Document,
    document,
    listeners,
    requests,
    supply: (cookies, id = extensionId) =>
      listeners['pocket-frame-cookies']?.({ detail: JSON.stringify({ extensionId: id, cookies }) }),
    advance: ms => (now += ms)
  };
}

test('the page-world bridge appends supplied cookies to the panel document only', () => {
  const page = mainWorld();
  assert.equal(page.document.cookie, 'none=1');
  page.supply(['lax=1'], 'bcdefghijklmnopabcdefghijklmnopa');
  assert.equal(page.document.cookie, 'none=1', 'another extension ID is ignored');
  page.supply(['lax=1', 'none=1']);
  assert.equal(page.document.cookie, 'none=1; lax=1');
  assert.equal(Object.create(page.Document.prototype).cookie, '');
  assert.deepEqual(page.requests, ['pocket-frame-cookies-request']);
  page.document.cookie;
  assert.equal(page.requests.length, 1, 'refreshes are throttled');
  page.advance(1000);
  page.document.cookie;
  assert.equal(page.requests.length, 2);
  page.supply(['strict=1']);
  assert.equal(page.document.cookie, 'none=1; strict=1');
  page.document.cookie = 'written=1';
  assert.equal(page.document.cookie, 'written=1; strict=1', 'native writes are unchanged');
  page.supply('lax=1');
  assert.equal(page.document.cookie, 'written=1; strict=1', 'malformed updates are ignored');
});

test('the page-world bridge ignores tabs, nested frames and non-HTTPS documents', () => {
  for (const options of [
    { ancestorOrigins: [] },
    { ancestorOrigins: ['https://site.example', `chrome-extension://${extensionId}`] },
    { ancestorOrigins: ['https://site.example'] },
    { protocol: 'http:' }
  ]) {
    const page = mainWorld(options);
    assert.equal(page.listeners['pocket-frame-cookies'], undefined);
  }
});

async function gate({ incognito = false, parent = `chrome-extension://${extensionId}` } = {}) {
  const messages = [],
    events = [],
    listeners = {};
  const context = {
    chrome: {
      runtime: {
        id: extensionId,
        sendMessage: message => {
          messages.push(message);
          return Promise.resolve({ ok: true, data: ['lax=1'] });
        }
      },
      extension: { inIncognitoContext: incognito }
    },
    document: {
      addEventListener: (type, listener) => (listeners[type] = listener),
      dispatchEvent: event => events.push(event)
    },
    location: { href: 'https://example.com/a', protocol: 'https:', ancestorOrigins: [parent] },
    top: {},
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  };
  context.window = context;
  runInNewContext(script('frame-cookies-gate'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { messages, events, listeners };
}

test('the isolated gate requests cookies for its own URL and forwards them to the page', async () => {
  const frame = await gate();
  // Objects created in the script context have that realm's prototypes.
  assert.deepEqual(JSON.parse(JSON.stringify(frame.messages)), [
    { type: 'FRAME_COOKIES', url: 'https://example.com/a' }
  ]);
  assert.equal(frame.events[0].type, 'pocket-frame-cookies');
  assert.deepEqual(JSON.parse(frame.events[0].detail), { extensionId, cookies: ['lax=1'] });
  frame.listeners['pocket-frame-cookies-request']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(frame.messages.length, 2);
  for (const options of [{ incognito: true }, { parent: 'chrome-extension://other' }]) {
    const other = await gate(options);
    assert.deepEqual(other.messages, []);
  }
});
