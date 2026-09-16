import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { Script } from 'node:vm';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dist), 'utf8'));
const files = readdirSync(dist, { recursive: true }).filter(file => /\.[^/]+$/.test(file));

test('the extension artifact contains only runtime files with all entry paths resolved', () => {
  for (const file of files) {
    assert(/\.(?:html|js|css|json|png)$/.test(file), `Unexpected artifact: ${file}`);
    assert(!/(?:^|\/)(?:src|tests|scripts|node_modules|output|releases|\.git)\//.test(file));
    assert(!/(?:package(?:-lock)?|tsconfig).*\.json$/.test(file));
  }
  const entries = [
    manifest.background.service_worker,
    manifest.side_panel.default_path,
    manifest.options_ui.page,
    'help.html',
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap(script => script.js),
    'mobile-identity-gate.js',
    'mobile-identity-main.js'
  ];
  for (const entry of entries) assert(existsSync(new URL(entry, dist)), `Missing entry: ${entry}`);
  for (const file of files.filter(name => name.endsWith('.html'))) {
    const source = readFileSync(new URL(file, dist), 'utf8');
    for (const [, url] of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(?:https?:|#)/.test(url)) continue;
      assert(existsSync(new URL(url, new URL(file, dist))), `${file}: missing asset ${url}`);
    }
    assert(!source.includes('.ts"'), `${file}: uncompiled TypeScript reference`);
  }
  assert.deepEqual(
    manifest,
    JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'))
  );
});

test('all injected content scripts parse as classic scripts, without module dependencies', () => {
  for (const name of ['frame-navigation', 'mobile-identity-gate', 'mobile-identity-main']) {
    const source = readFileSync(new URL(`${name}.js`, dist), 'utf8');
    assert.doesNotThrow(() => new Script(source, { filename: `${name}.js` }));
    assert(!/\bimport\s*\(/.test(source), `${name}: dynamic import in an injected script`);
  }
});
