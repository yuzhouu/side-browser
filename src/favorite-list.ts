import { element } from './dom.js';
import type { Favorite } from './types.js';
import { t } from './i18n.js';
import { recentFaviconUrl } from './recent-urls.js';

export class FavoriteList {
  private section = element('#favorites');
  private list = element('#favorite-list');
  private template = element<HTMLTemplateElement>('#favorite-item-template');
  private renderedUrls = '';
  private tooltip = element('#favorite-tooltip');
  private tooltipTarget: HTMLButtonElement | null = null;

  constructor({
    run,
    onOpen,
    onRemove
  }: {
    run: <T>(task: () => T | PromiseLike<T>) => Promise<T>;
    onOpen: (url: string) => Promise<void>;
    onRemove: (url: string) => Promise<Favorite[]>;
  }) {
    this.list.addEventListener('click', event => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('button[data-url]')
          : null;
      if (!button) return;
      this.hideTooltip();
      const url = button.dataset.url!;
      if (button.matches('.favorite-remove')) {
        const index = [...this.list.querySelectorAll('.favorite-remove')].indexOf(button);
        void run(async () => {
          this.render(await onRemove(url));
          // A remote update may have removed the focused item already.
          if (!element('#empty').hidden) {
            const remaining = this.list.querySelectorAll<HTMLButtonElement>('.favorite-remove');
            (remaining[Math.min(index, remaining.length - 1)] || element('#empty-address')).focus();
          }
        });
      } else void run(() => onOpen(url));
    });
    element('#empty').addEventListener('scroll', () => this.hideTooltip());
    window.addEventListener('resize', () => this.hideTooltip());
    window.addEventListener('blur', () => this.hideTooltip());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.hideTooltip();
    });
  }

  private hideTooltip() {
    this.tooltip.hidePopover();
    this.tooltipTarget?.removeAttribute('aria-describedby');
    this.tooltipTarget = null;
  }

  private showTooltip(button: HTMLButtonElement) {
    this.tooltipTarget = button;
    element('.favorite-tooltip-title', this.tooltip).textContent =
      button.getAttribute('aria-label');
    element('.favorite-tooltip-url', this.tooltip).textContent = button.dataset.url!;
    button.setAttribute('aria-describedby', 'favorite-tooltip');
    this.tooltip.showPopover();
    const target = button.getBoundingClientRect();
    const box = this.tooltip.getBoundingClientRect();
    this.tooltip.style.left = `${Math.max(8, Math.min(target.x + target.width / 2 - box.width / 2, innerWidth - box.width - 8))}px`;
    const top = target.top >= box.height + 16 ? target.top - box.height - 8 : target.bottom + 8;
    this.tooltip.style.top = `${Math.max(8, Math.min(top, innerHeight - box.height - 8))}px`;
  }

  private createItem(favorite: Favorite) {
    const item = this.template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const open = element<HTMLButtonElement>('.favorite-open', item);
    const remove = element<HTMLButtonElement>('.favorite-remove', item);
    const icon = element<HTMLImageElement>('img', item);
    const fallback = element<SVGElement>('.recent-icon svg', item);
    open.dataset.url = favorite.url;
    open.addEventListener('pointerenter', () => this.showTooltip(open));
    open.addEventListener('pointerleave', () => {
      if (document.activeElement !== open) this.hideTooltip();
    });
    open.addEventListener('focus', () => this.showTooltip(open));
    open.addEventListener('blur', () => this.hideTooltip());
    remove.dataset.url = favorite.url;
    remove.title = t('removeFavorite');
    icon.onload = () => {
      icon.hidden = false;
      fallback.setAttribute('hidden', '');
    };
    icon.onerror = () => {
      icon.hidden = true;
      fallback.removeAttribute('hidden');
    };
    icon.src = recentFaviconUrl(favorite.url, chrome.runtime.getURL('/'));
    return item;
  }

  render(favorites: Favorite[]) {
    const key = JSON.stringify(favorites.map(item => item.url));
    const focused = document.activeElement as HTMLButtonElement | null;
    const focusedUrl = this.list.contains(focused) ? focused?.dataset.url : undefined;
    const focusedClass = focused?.matches('.favorite-remove')
      ? '.favorite-remove'
      : '.favorite-open';
    if (key !== this.renderedUrls) {
      this.hideTooltip();
      this.renderedUrls = key;
      this.list.replaceChildren(...favorites.map(item => this.createItem(item)));
      if (focusedUrl && !element('#empty').hidden) {
        const replacement = [...this.list.querySelectorAll<HTMLButtonElement>(focusedClass)].find(
          button => button.dataset.url === focusedUrl
        );
        (replacement || element('#empty-address')).focus();
      }
    }
    for (const [index, item] of [...this.list.children].entries()) {
      const { url, title } = favorites[index];
      const label = title || new URL(url).host;
      const open = element('.favorite-open', item);
      open.setAttribute('aria-label', label);
      element('.favorite-remove', item).setAttribute(
        'aria-label',
        `${t('removeFavorite')}: ${label}`
      );
    }
    this.section.hidden = !favorites.length;
    if (this.tooltipTarget) this.showTooltip(this.tooltipTarget);
  }
}
