import { element } from './dom.js';
import { errorMessage, t } from './i18n.js';
import { parseCustomSearchEngine, validSearchEngine } from './search-engine.js';
import type { CustomSearchEngine, SearchEngine, Settings } from './types.js';

export class SearchEngineSettings {
  private select = element<HTMLSelectElement>('#search-engine');
  private form = element<HTMLFormElement>('#custom-search-engine');
  private name = element<HTMLInputElement>('#custom-search-name');
  private url = element<HTMLInputElement>('#custom-search-url');
  private save = element<HTMLButtonElement>('#save-custom-search');
  private cancel = element<HTMLButtonElement>('#cancel-custom-search');
  private feedback = element('#custom-search-feedback');
  private settings?: Settings;
  private busy = false;
  private draft = false;

  constructor(
    private onSelect: (engine: SearchEngine) => Promise<unknown>,
    private onSave: (custom: CustomSearchEngine) => Promise<boolean>
  ) {
    this.select.addEventListener('change', () => {
      this.feedback.textContent = '';
      if (this.select.value === 'custom') {
        this.draft = true;
        this.render(this.settings, this.busy);
        this.name.focus();
      } else {
        this.draft = false;
        void this.onSelect(validSearchEngine(this.select.value));
      }
    });
    this.form.addEventListener('input', () => {
      this.draft = true;
      this.feedback.textContent = '';
      this.name.removeAttribute('aria-invalid');
      this.url.removeAttribute('aria-invalid');
    });
    this.form.addEventListener('submit', event => {
      event.preventDefault();
      void this.submit();
    });
    this.cancel.addEventListener('click', () => {
      this.draft = false;
      this.feedback.textContent = '';
      this.render(this.settings, this.busy);
      this.select.focus();
    });
    this.form.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.isComposing && !this.busy) {
        event.preventDefault();
        this.cancel.click();
      }
    });
  }

  render(settings: Settings | undefined, busy: boolean) {
    this.settings = settings;
    this.busy = busy;
    const disabled = busy || !settings;
    this.select.disabled = disabled;
    this.name.disabled = this.url.disabled = this.save.disabled = this.cancel.disabled = disabled;
    // Other settings and window-focus refreshes must not discard an unfinished form.
    if (!this.draft && !busy && settings) {
      this.select.value = settings.searchEngine;
      this.name.value = settings.customSearchEngine?.name || '';
      this.url.value = settings.customSearchEngine?.url || '';
      this.name.removeAttribute('aria-invalid');
      this.url.removeAttribute('aria-invalid');
    }
    this.form.hidden = this.select.value !== 'custom';
  }

  private async submit() {
    if (this.busy || !this.settings) return;
    let custom: CustomSearchEngine;
    try {
      custom = parseCustomSearchEngine({ name: this.name.value, url: this.url.value });
    } catch (error) {
      this.feedback.textContent = errorMessage(error);
      const field =
        (error as { code: string }).code === 'errorCustomSearchName' ? this.name : this.url;
      field.setAttribute('aria-invalid', 'true');
      field.focus();
      return;
    }
    this.draft = true;
    this.feedback.textContent = t('settingsSaving');
    if (await this.onSave(custom)) {
      this.draft = false;
      this.feedback.textContent = t('settingsSaved');
      this.render(this.settings, this.busy);
    }
  }

  showError(error: unknown) {
    this.feedback.textContent = errorMessage(error);
  }
}
