import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseInput, mobileIdentity } from '../src/config.ts';
import { frameDestination } from '../src/embedding.ts';
import { navigatePanel, restorePanel } from '../src/sidepanel-state.ts';
import { errorMessage } from '../src/i18n.ts';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const locales = readdirSync(new URL('public/_locales/', root));
const catalogs = Object.fromEntries(
  locales.map(locale => [locale, JSON.parse(read(`public/_locales/${locale}/messages.json`))])
);
const manifest = JSON.parse(read('public/manifest.json'));
const defaults = catalogs[manifest.default_locale];

test('every shipped locale has complete messages and matching named placeholders', () => {
  assert.equal(manifest.default_locale, 'en');
  for (const locale of ['en', 'zh_CN', 'zh_TW', 'ja', 'de', 'fr', 'es'])
    assert(locales.includes(locale), `Missing supported locale: ${locale}`);
  for (const [locale, catalog] of Object.entries(catalogs)) {
    assert.equal(catalog.documentLanguage.message, locale.replace('_', '-'));
    assert(['ltr', 'rtl'].includes(catalog.documentDirection.message));
    assert(catalog.extensionDescription.message.length <= 132, `${locale}: description too long`);
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(defaults).sort(), locale);
    for (const [key, entry] of Object.entries(catalog)) {
      assert.equal(typeof entry.message, 'string', `${locale}/${key}`);
      assert(entry.message.trim(), `${locale}/${key} is empty`);
      const slots = message =>
        [...message.matchAll(/\$([a-z][a-z0-9_]*)\$/gi)]
          .map(match => match[1].toLowerCase())
          .sort();
      assert.deepEqual(
        slots(entry.message),
        slots(defaults[key].message),
        `${locale}/${key} substitutions`
      );
      assert.deepEqual(
        entry.placeholders,
        defaults[key].placeholders,
        `${locale}/${key} placeholder definitions`
      );
      for (const slot of slots(entry.message))
        assert(entry.placeholders?.[slot], `${locale}/${key}/${slot}`);
    }
  }
});

test('manifest, HTML, JavaScript messages and error codes resolve to the default catalog', () => {
  const files = readdirSync(new URL('src/', root))
    .filter(name => /\.(?:html|ts)$/.test(name))
    .map(name => `src/${name}`);
  files.push('public/manifest.json');
  const patterns = [
    /__MSG_([a-z0-9_]+)__/gi,
    /data-i18n(?:-title|-placeholder|-aria-label)?="([a-z0-9_]+)"/gi,
    /\b(?:t|userError)\(\s*['"]([a-z0-9_]+)['"]/gi,
    /\bcode:\s*['"]([a-z0-9_]+)['"]/gi
  ];
  for (const file of files) {
    const source = read(file);
    for (const pattern of patterns) {
      for (const [, key] of source.matchAll(pattern))
        assert(defaults[key], `${file}: missing ${key}`);
    }
  }
});

test('shared logic reports stable error codes without requiring Chrome', () => {
  const cases = [
    [() => parseInput('https://example.com/\npath'), 'errorInvalidCharacters'],
    [() => parseInput('javascript:alert(1)'), 'errorUnsupportedScheme'],
    [() => parseInput('https://'), 'errorInvalidUrl'],
    [() => frameDestination('', parseInput), 'errorEmptyInput'],
    [() => navigatePanel(restorePanel(), 'chrome://settings'), 'errorUnsupportedUrl'],
    [() => mobileIdentity('Unknown browser'), 'errorChromeVersion']
  ];
  for (const [run, code] of cases) assert.throws(run, { code });
});

test('UI translates error codes after message serialization and preserves browser error details', context => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else delete globalThis.chrome;
  });
  for (const catalog of Object.values(catalogs)) {
    globalThis.chrome = { i18n: { getMessage: key => catalog[key]?.message || '' } };
    let error;
    try {
      frameDestination('', parseInput);
    } catch (value) {
      error = value;
    }
    const response = JSON.parse(JSON.stringify({ error: error.message, errorCode: error.code }));
    const received = Object.assign(new Error(response.error), { code: response.errorCode });
    assert.equal(errorMessage(received), catalog.errorEmptyInput.message);
    assert.equal(errorMessage({ code: 'missingError' }), catalog.errorUnexpected.message);
    assert.equal(errorMessage(new Error('Browser API detail')), 'Browser API detail');
    assert.equal(errorMessage(undefined), catalog.errorUnexpected.message);
  }
});
