import { element } from './dom.js';
import { favoriteLabel } from './favorites.js';
import { recentFaviconUrl } from './recent-urls.js';
import type { Favorite } from './types.js';

export class FavoriteMenu {
  private list = element('#saved-list');
  private empty = element('#saved-empty');

  constructor({
    run,
    onOpen,
    onEdit
  }: {
    run: <T>(task: () => T | PromiseLike<T>) => Promise<T>;
    onOpen: (url: string) => Promise<void>;
    onEdit: () => Promise<void>;
  }) {
    element('#edit-favorites').addEventListener('click', () => {
      element('#recent-menu').hidePopover();
      void run(onEdit).catch(() => {});
    });
    this.list.addEventListener('click', event => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('.saved-open')
          : null;
      if (!button) return;
      element('#recent-menu').hidePopover();
      void run(() => onOpen(button.dataset.url!)).catch(() => {});
    });
    this.list.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...this.list.querySelectorAll<HTMLButtonElement>('.saved-open')];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? buttons.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    });
  }

  private createItem(url: string) {
    const template = element<HTMLTemplateElement>('#recent-item-template');
    const item = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    item.classList.add('saved-item');
    item.dataset.url = url;
    element('.recent-remove', item).remove();
    const open = element<HTMLButtonElement>('.recent-open', item);
    open.className = 'saved-open';
    open.dataset.url = url;
    element('.recent-url', item).textContent = url;
    const icon = element<HTMLImageElement>('img', item);
    const fallback = element<SVGElement>('.recent-icon svg', item);
    icon.onload = () => {
      icon.hidden = false;
      fallback.setAttribute('hidden', '');
    };
    icon.onerror = () => {
      icon.hidden = true;
      fallback.removeAttribute('hidden');
    };
    icon.src = recentFaviconUrl(url, chrome.runtime.getURL('/'));
    return item;
  }

  render(favorites: Favorite[], currentUrl: string) {
    const focused = document.activeElement as HTMLElement | null;
    const focusedRow = focused?.closest<HTMLElement>('.saved-item');
    const focusedIndex = focusedRow ? [...this.list.children].indexOf(focusedRow) : -1;
    const existing = new Map(
      [...this.list.querySelectorAll<HTMLElement>('.saved-item')].map(row => [
        row.dataset.url!,
        row
      ])
    );
    for (const [index, favorite] of favorites.entries()) {
      const row = existing.get(favorite.url) || this.createItem(favorite.url);
      existing.delete(favorite.url);
      if (this.list.children[index] !== row)
        this.list.insertBefore(row, this.list.children[index] || null);
      const label = favoriteLabel(favorite);
      const open = element<HTMLButtonElement>('.saved-open', row);
      element('.recent-label', row).textContent = label;
      open.title = `${label}\n${favorite.url}`;
      if (favorite.url === currentUrl) open.setAttribute('aria-current', 'page');
      else open.removeAttribute('aria-current');
    }
    for (const row of existing.values()) row.remove();
    this.empty.hidden = !!favorites.length;
    if (focusedIndex >= 0 && element('#recent-menu').matches(':popover-open')) {
      const row = focusedRow?.isConnected
        ? focusedRow
        : this.list.children[Math.min(focusedIndex, favorites.length - 1)];
      (row?.querySelector<HTMLButtonElement>('.saved-open') || element('#favorites-tab')).focus();
    }
  }
}
