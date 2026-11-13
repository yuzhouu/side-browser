import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { SearchEngineSettings } from '../src/search-engine-settings.ts';

function setup(context, initial = { searchEngine: 'google', customSearchEngine: null }) {
  const globals = ['document', 'chrome'].map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]);
  context.after(() => {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const fields = new Map();
  const field = id => {
    if (!fields.has(id)) {
      const listeners = new Map();
      const attributes = new Map();
      fields.set(id, {
        value: '',
        textContent: '',
        disabled: false,
        hidden: false,
        addEventListener(type, callback) {
          listeners.set(type, callback);
        },
        fire(type, event = {}) {
          return listeners.get(type)?.({ preventDefault() {}, ...event });
        },
        focus() {
          document.activeElement = this;
        },
        click() {
          if (!this.disabled) this.fire('click');
        },
        setAttribute(key, value) {
          attributes.set(key, value);
        },
        getAttribute(key) {
          return attributes.get(key);
        },
        removeAttribute(key) {
          attributes.delete(key);
        }
      });
    }
    return fields.get(id);
  };
  globalThis.document = { querySelector: selector => field(selector.slice(1)) };
  globalThis.chrome = { i18n: { getMessage: key => key } };
  let settings = initial;
  let failed = false;
  const selections = [];
  const saves = [];
  const controller = new SearchEngineSettings(
    async searchEngine => {
      selections.push(searchEngine);
      settings = { ...settings, searchEngine };
      controller.render(settings, false);
    },
    async customSearchEngine => {
      saves.push(customSearchEngine);
      controller.render(settings, true);
      await setImmediate();
      if (!failed) settings = { ...settings, searchEngine: 'custom', customSearchEngine };
      controller.render(settings, false);
      if (failed) controller.showError(new Error('Storage unavailable'));
      return !failed;
    }
  );
  controller.render(settings, false);
  return {
    field,
    controller,
    selections,
    saves,
    fail: value => {
      failed = value;
    },
    settings: () => settings
  };
}

test('custom settings keep unfinished input during refresh and cancel without changing the engine', context => {
  const { field, controller, selections, saves } = setup(context);
  const select = field('search-engine');
  const form = field('custom-search-engine');
  assert.equal(form.hidden, true);
  select.value = 'custom';
  select.fire('change');
  assert.equal(form.hidden, false);
  assert.equal(document.activeElement, field('custom-search-name'));
  field('custom-search-name').value = 'Draft';
  field('custom-search-url').value = 'https://draft.example/?q=%s';
  form.fire('input');
  const external = { searchEngine: 'yahoo-japan', customSearchEngine: null };
  controller.render(external, true);
  assert.equal(field('save-custom-search').disabled, true);
  controller.render(external, false);
  assert.equal(select.value, 'custom');
  assert.equal(field('custom-search-name').value, 'Draft');
  assert.equal(field('custom-search-url').value, 'https://draft.example/?q=%s');
  assert.deepEqual(selections, []);
  assert.deepEqual(saves, []);
  form.fire('keydown', { key: 'Escape', isComposing: true });
  assert.equal(form.hidden, false);
  form.fire('keydown', { key: 'Escape' });
  assert.equal(select.value, 'yahoo-japan');
  assert.equal(form.hidden, true);
  assert.equal(document.activeElement, select);
});

test('custom settings validate before saving, retain failed drafts and apply a successful retry', async context => {
  const { field, controller, saves, fail, settings } = setup(context);
  field('search-engine').value = 'custom';
  field('search-engine').fire('change');
  const form = field('custom-search-engine');
  form.fire('submit');
  assert.equal(field('custom-search-name').getAttribute('aria-invalid'), 'true');
  assert.equal(saves.length, 0);
  field('custom-search-name').value = '  My search  ';
  field('custom-search-url').value = 'https://example.com/';
  form.fire('input');
  form.fire('submit');
  assert.equal(field('custom-search-url').getAttribute('aria-invalid'), 'true');
  assert.equal(saves.length, 0);
  field('custom-search-url').value = 'https://example.com/?q=%s';
  form.fire('input');
  fail(true);
  form.fire('submit');
  assert.equal(field('save-custom-search').disabled, true);
  await setImmediate();
  assert.equal(settings().searchEngine, 'google');
  assert.equal(field('custom-search-name').value, '  My search  ');
  assert.equal(field('custom-search-feedback').textContent, 'Storage unavailable');
  assert.equal(field('save-custom-search').disabled, false);
  fail(false);
  form.fire('submit');
  await setImmediate();
  assert.equal(settings().searchEngine, 'custom');
  assert.deepEqual(settings().customSearchEngine, {
    name: 'My search',
    url: 'https://example.com/?q=%s'
  });
  assert.equal(field('custom-search-name').value, 'My search');
  assert.equal(field('custom-search-feedback').textContent, 'settingsSaved');
  controller.render(
    {
      searchEngine: 'custom',
      customSearchEngine: { name: 'Changed elsewhere', url: 'https://elsewhere.example/?q=%s' }
    },
    false
  );
  assert.equal(field('custom-search-name').value, 'Changed elsewhere');
});

test('switching back to a built-in engine keeps the saved custom template available', context => {
  const custom = { name: 'Saved', url: 'https://example.com/?q=%s' };
  const { field, selections, settings } = setup(context, {
    searchEngine: 'custom',
    customSearchEngine: custom
  });
  assert.equal(field('custom-search-engine').hidden, false);
  field('custom-search-name').value = 'Unfinished edit';
  field('custom-search-engine').fire('input');
  field('search-engine').value = 'yahoo-japan';
  field('search-engine').fire('change');
  assert.deepEqual(selections, ['yahoo-japan']);
  assert.deepEqual(settings().customSearchEngine, custom);
  field('search-engine').value = 'custom';
  field('search-engine').fire('change');
  assert.equal(field('custom-search-name').value, 'Saved');
  assert.equal(field('custom-search-url').value, custom.url);
});
