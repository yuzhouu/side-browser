import { element } from './dom.js';
import type { SearchEngine } from './types.js';
import { SEARCH_ENGINES } from './search-engine.js';
import { t } from './i18n.js';
import { recentFaviconUrl } from './recent-urls.js';
import {
  localCandidates,
  querySuggestions,
  rankSuggestions,
  withSearchSuggestion,
  type AddressSuggestion,
  type SuggestionState
} from './address-suggestions.js';

export class AddressAutocomplete {
  private input = element<HTMLInputElement>('#address');
  private list = element('#address-suggestions');
  private items: AddressSuggestion[] = [];
  private selected = -1;
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private composing = false;
  private localKey = '';

  sync() {
    if (
      this.list.matches(':popover-open') &&
      this.localKey !== JSON.stringify([localCandidates(this.getState()), this.getEngine()])
    )
      this.refresh();
  }

  constructor(
    private getState: () => SuggestionState | undefined,
    private onOpen: (url: string) => void,
    private getEngine: () => SearchEngine
  ) {
    this.input.addEventListener('focus', () => this.input.select());
    this.input.addEventListener('mousedown', event => {
      if (event.button === 0 && document.activeElement !== this.input) {
        // Keep the initial click from replacing the full selection with a caret.
        event.preventDefault();
        this.input.focus();
      }
    });
    this.input.addEventListener('input', () => {
      if (!this.composing) this.refresh();
    });
    // Restoring focus after closing a page must not cover the welcome-page favorites.
    this.input.addEventListener('click', () => {
      if (!this.list.matches(':popover-open')) this.refresh();
    });
    this.input.addEventListener('blur', () => this.hide());
    this.input.addEventListener('compositionstart', () => {
      this.composing = true;
      this.hide();
    });
    this.input.addEventListener('compositionend', () => {
      this.composing = false;
      this.refresh();
    });
    this.input.addEventListener('keydown', event => {
      if (event.isComposing || this.composing || event.keyCode === 229) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.hide();
        return;
      }
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      if (!this.list.matches(':popover-open')) this.refresh();
      if (!this.items.length) return;
      event.preventDefault();
      this.selected =
        (this.selected +
          (event.key === 'ArrowDown' ? 1 : this.selected < 0 ? 0 : -1) +
          this.items.length) %
        this.items.length;
      this.updateSelection();
    });
    this.list.addEventListener('pointerdown', event => event.preventDefault());
    this.list.addEventListener('click', event => {
      const option =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[data-index]') : null;
      const item = option && this.items[Number(option.dataset.index)];
      if (item) this.onOpen(item.url);
    });
    document.addEventListener(
      'pointerdown',
      event => {
        if (!event.composedPath().includes(this.input) && !event.composedPath().includes(this.list))
          this.hide();
      },
      true
    );
    window.addEventListener('blur', () => this.hide());
  }

  get value() {
    return this.items[this.selected]?.url || this.input.value;
  }
  get isComposing() {
    return this.composing;
  }

  hide() {
    clearTimeout(this.timer);
    this.revision++;
    this.list.hidePopover();
    this.items = [];
    this.list.replaceChildren();
    this.selected = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }

  refresh() {
    this.hide();
    if (document.activeElement !== this.input || this.composing) return;
    const revision = this.revision;
    const query = this.input.value;
    const state = this.getState();
    this.localKey = JSON.stringify([localCandidates(state), this.getEngine()]);
    this.render(rankSuggestions(query, localCandidates(state)));
    this.timer = setTimeout(async () => {
      const items = await querySuggestions(query, this.getState());
      if (revision === this.revision && document.activeElement === this.input) this.render(items);
    }, 120);
  }

  private render(items: AddressSuggestion[]) {
    items = withSearchSuggestion(this.input.value, this.getEngine(), items);
    const selectedUrl = this.items[this.selected]?.url;
    this.items = items;
    this.selected = selectedUrl ? items.findIndex(item => item.url === selectedUrl) : -1;
    this.list.replaceChildren(
      ...items.map((item, index) => {
        const option = document.createElement('div');
        option.id = `address-option-${index}`;
        option.className = 'address-option';
        option.setAttribute('role', 'option');
        option.dataset.index = String(index);
        option.dataset.kind = item.search ? 'search' : 'url';
        const text = document.createElement('span');
        text.className = 'recent-text';
        let icon: Element;
        let lines: string[][];
        if (item.search) {
          const engine =
            item.search.engine === 'baidu'
              ? t('searchEngineBaidu')
              : SEARCH_ENGINES[item.search.engine].name;
          const label = t('searchWithEngine', engine);
          option.title = `${label}\n${item.search.text}`;
          icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          icon.setAttribute('viewBox', '0 0 24 24');
          icon.setAttribute('aria-hidden', 'true');
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', '10.5');
          circle.setAttribute('cy', '10.5');
          circle.setAttribute('r', '6.5');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'm16 16 5 5');
          icon.append(circle, path);
          lines = [
            ['recent-label', label],
            ['search-query', item.search.text]
          ];
        } else {
          option.title = `${item.title || new URL(item.url).host}\n${item.url}\n${item.sources.map(source => t(source)).join(' · ')}`;
          const image = document.createElement('img');
          image.width = image.height = 16;
          image.alt = '';
          image.src = recentFaviconUrl(item.url, chrome.runtime.getURL('/'));
          image.onerror = () => {
            image.style.visibility = 'hidden';
          };
          icon = image;
          lines = [
            ['recent-label', item.title || new URL(item.url).host],
            ['recent-url', item.url],
            ['suggestion-source', item.sources.map(source => t(source)).join(' · ')]
          ];
        }
        for (const [className, value] of lines) {
          const line = document.createElement('span');
          line.className = className;
          line.textContent = value;
          text.append(line);
        }
        option.append(icon, text);
        return option;
      })
    );
    if (items.length) {
      element('#recent-menu').hidePopover();
      element('#more-menu').hidePopover();
      this.list.showPopover();
    } else this.list.hidePopover();
    this.input.setAttribute('aria-expanded', String(Boolean(items.length)));
    this.updateSelection();
  }

  private updateSelection() {
    for (const [index, option] of [...this.list.children].entries())
      option.setAttribute('aria-selected', String(index === this.selected));
    const selected = this.list.children[this.selected];
    if (selected) {
      this.input.setAttribute('aria-activedescendant', selected.id);
      selected.scrollIntoView({ block: 'nearest' });
    } else this.input.removeAttribute('aria-activedescendant');
  }
}
