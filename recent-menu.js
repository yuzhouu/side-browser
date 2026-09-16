import { t } from './i18n.js';
import { recentFaviconUrl } from './recent-urls.js';

// Owns menu DOM and focus. Navigation and persisted data stay with the caller.
export class RecentMenu {
  constructor({ run, onOpen, onRemove, onClear }) {
    this.menu = document.querySelector('#recent-menu');
    this.list = document.querySelector('#recent-list');
    this.trigger = document.querySelector('#recent');
    this.clear = document.querySelector('#clear-recent');
    this.empty = document.querySelector('#recent-empty');
    this.template = document.querySelector('#recent-item-template');
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
      const button = event.target.closest('button[data-url]');
      if (!button) return;
      if (button.matches('.recent-remove')) {
        const index = [...this.list.querySelectorAll('.recent-remove')].indexOf(button);
        void run(async () => {
          this.render(await onRemove(button.dataset.url));
          const remaining = this.list.querySelectorAll('.recent-remove');
          (remaining[Math.min(index, remaining.length - 1)] || this.trigger).focus();
        });
        return;
      }
      this.hide();
      void run(() => onOpen(button.dataset.url));
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

  moveFocus(event) {
    const selector = document.activeElement.matches('.recent-remove')
      ? '.recent-remove'
      : '.recent-open';
    const buttons = [...this.list.querySelectorAll(selector)];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  createItem(url) {
    const item = this.template.content.firstElementChild.cloneNode(true);
    const button = item.querySelector('.recent-open');
    const remove = item.querySelector('.recent-remove');
    const icon = item.querySelector('img');
    const fallback = item.querySelector('.recent-icon svg');
    button.dataset.url = url;
    button.title = url;
    item.querySelector('.recent-label').textContent = new URL(url).host;
    item.querySelector('.recent-url').textContent = url;
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

  render(state) {
    const urls = state?.recentUrls || [];
    const key = JSON.stringify(urls);
    if (this.renderedUrls !== key) {
      this.renderedUrls = key;
      this.list.replaceChildren(...urls.map(url => this.createItem(url)));
    }
    for (const button of this.list.querySelectorAll('.recent-open')) {
      const url = button.dataset.url;
      const title = state?.recentTitles?.[url];
      button.querySelector('.recent-label').textContent = title || new URL(url).host;
      button.title = title ? `${title}\n${url}` : url;
      if (url === state?.url) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    this.clear.disabled = !urls.length;
    this.empty.hidden = !!urls.length;
  }
}
