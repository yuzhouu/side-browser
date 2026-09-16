import { element } from './dom.js';
import type { PanelSnapshot } from './types.js';
import { t } from './i18n.js';
import { recentFaviconUrl } from './recent-urls.js';

// Owns menu DOM and focus. Navigation and persisted data stay with the caller.
export class RecentMenu {
  menu: HTMLElement;
  list: HTMLElement;
  trigger: HTMLButtonElement;
  clear: HTMLButtonElement;
  empty: HTMLElement;
  template: HTMLTemplateElement;
  extensionRoot: string;
  renderedUrls: string;
  constructor({
    run,
    onOpen,
    onRemove,
    onClear
  }: {
    run: <T>(task: () => T | PromiseLike<T>) => Promise<T>;
    onOpen: (url: string) => Promise<void>;
    onRemove: (url: string) => Promise<PanelSnapshot>;
    onClear: () => Promise<PanelSnapshot>;
  }) {
    this.menu = element('#recent-menu');
    this.list = element('#recent-list');
    this.trigger = element<HTMLButtonElement>('#recent');
    this.clear = element<HTMLButtonElement>('#clear-recent');
    this.empty = element('#recent-empty');
    this.template = element<HTMLTemplateElement>('#recent-item-template');
    this.extensionRoot = chrome.runtime.getURL('/');
    this.renderedUrls = '';

    document.addEventListener(
      'pointerdown',
      event => {
        const path = event.composedPath();
        if (!path.includes(this.menu) && !path.includes(this.trigger)) this.hide();
      },
      true
    );
    // Pointer events inside the cross-origin webpage do not reach this document.
    window.addEventListener('blur', () => this.hide());

    this.list.addEventListener('click', event => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('button[data-url]')
          : null;
      if (!button) return;
      if (button.matches('.recent-remove')) {
        const index = [...this.list.querySelectorAll<HTMLButtonElement>('.recent-remove')].indexOf(
          button
        );
        void run(async () => {
          this.render(await onRemove(button.dataset.url!));
          const remaining = this.list.querySelectorAll<HTMLButtonElement>('.recent-remove');
          (remaining[Math.min(index, remaining.length - 1)] || this.trigger).focus();
        });
        return;
      }
      this.hide();
      void run(() => onOpen(button.dataset.url!));
    });
    this.clear.addEventListener('click', () => {
      void run(async () => {
        this.render(await onClear());
        this.trigger.focus();
      });
    });
    this.list.addEventListener('keydown', event => this.moveFocus(event));
  }

  hide() {
    this.menu.hidePopover();
  }

  moveFocus(event: KeyboardEvent) {
    const selector = document.activeElement?.matches('.recent-remove')
      ? '.recent-remove'
      : '.recent-open';
    const buttons = [...this.list.querySelectorAll<HTMLButtonElement>(selector)];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  createItem(url: string) {
    const item = this.template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const button = element<HTMLButtonElement>('.recent-open', item);
    const remove = element<HTMLButtonElement>('.recent-remove', item);
    const icon = element<HTMLImageElement>('img', item);
    const fallback = element<SVGElement>('.recent-icon svg', item);
    button.dataset.url = url;
    button.title = url;
    element('.recent-label', item).textContent = new URL(url).host;
    element('.recent-url', item).textContent = url;
    remove.dataset.url = url;
    remove.title = t('removeRecent');
    remove.setAttribute('aria-label', `${t('removeRecent')}: ${url}`);
    icon.onload = () => {
      icon.hidden = false;
      fallback.setAttribute('hidden', '');
    };
    icon.onerror = () => {
      icon.hidden = true;
      fallback.removeAttribute('hidden');
    };
    icon.src = recentFaviconUrl(url, this.extensionRoot);
    return item;
  }

  render(state: PanelSnapshot | undefined) {
    const urls = state?.recentUrls || [];
    const key = JSON.stringify(urls);
    if (this.renderedUrls !== key) {
      this.renderedUrls = key;
      this.list.replaceChildren(...urls.map(url => this.createItem(url)));
    }
    for (const button of this.list.querySelectorAll<HTMLButtonElement>('.recent-open')) {
      const url = button.dataset.url!;
      const title = state?.recentTitles?.[url];
      element('.recent-label', button).textContent = title || new URL(url).host;
      button.title = title ? `${title}\n${url}` : url;
      if (url === state?.url) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    this.clear.disabled = !urls.length;
    this.empty.hidden = !!urls.length;
  }
}
