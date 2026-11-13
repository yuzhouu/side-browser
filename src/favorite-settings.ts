import { element } from './dom.js';
import { favoriteLabel, favoriteUrl } from './favorites.js';
import { errorMessage, t } from './i18n.js';
import type { Favorite } from './types.js';

export interface FavoriteSettingsActions {
  onRemove: (url: string) => Promise<Favorite[] | undefined>;
  onUpdate: (url: string, newUrl: string, title: string) => Promise<Favorite[] | undefined>;
  onMove: (
    url: string,
    targetUrl: string,
    position: 'before' | 'after'
  ) => Promise<Favorite[] | undefined>;
}

// Settings owns editing; the sidebar only opens saved pages and links here.
export class FavoriteSettings {
  private list = element('#managed-list');
  private empty = element('#managed-empty');
  private feedback = element('#managed-feedback');
  private favorites: Favorite[] = [];
  private locked = false;
  private busy = false;
  private editor: HTMLFormElement | null = null;

  constructor(private actions: FavoriteSettingsActions) {
    this.list.addEventListener('click', event => {
      const button =
        event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      const row = button?.closest<HTMLElement>('.managed-item');
      if (!button || !row) return;
      const url = row.dataset.url!;
      const action = button.dataset.action;
      if (action === 'cancel') this.cancelEditing(true);
      else if (this.busy || this.locked) return;
      else if (action === 'edit') this.startEditing(row);
      else if (action === 'remove') this.change(() => actions.onRemove(url));
      else if (action === 'up' || action === 'down') {
        const index = this.favorites.findIndex(item => item.url === url);
        const target = this.favorites[index + (action === 'up' ? -1 : 1)];
        if (target)
          this.change(() => actions.onMove(url, target.url, action === 'up' ? 'before' : 'after'));
      }
    });
    this.list.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (
        event.key === 'Escape' &&
        event.target instanceof Node &&
        this.editor?.contains(event.target)
      ) {
        event.preventDefault();
        event.stopPropagation();
        this.cancelEditing(true);
        return;
      }
      if (event.target instanceof HTMLInputElement) {
        return;
      }
      const action = (document.activeElement as HTMLElement)?.dataset.action;
      if (!action || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...this.list.querySelectorAll<HTMLButtonElement>('button')].filter(
        button =>
          button.dataset.action === action && !button.disabled && !button.closest('[hidden]')
      );
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

  private cancelEditing(focus: boolean) {
    this.feedback.hidden = true;
    const row = this.editor?.closest<HTMLElement>('.managed-item');
    this.editor?.remove();
    this.editor = null;
    if (row) {
      element('.managed-info', row).hidden = false;
      element('.managed-actions', row).hidden = false;
    }
    if (focus) row?.querySelector<HTMLButtonElement>('[data-action="edit"]')?.focus();
  }

  private startEditing(row: HTMLElement) {
    this.cancelEditing(false);
    const template = element<HTMLTemplateElement>('#managed-editor-template');
    const form = template.content.firstElementChild!.cloneNode(true) as HTMLFormElement;
    const input = element<HTMLInputElement>('[name="title"]', form);
    const address = element<HTMLInputElement>('[name="url"]', form);
    const url = row.dataset.url!;
    input.value = favoriteLabel(this.favorites.find(item => item.url === url)!);
    input.setAttribute('aria-label', t('favoriteName'));
    address.value = url;
    address.setAttribute('aria-label', t('favoriteUrl'));
    for (const button of form.querySelectorAll<HTMLButtonElement>('button')) {
      button.title = t(button.dataset.i18nTitle!);
      button.setAttribute('aria-label', button.title);
    }
    for (const field of [input, address])
      field.addEventListener('input', () => field.setCustomValidity(''));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const title = input.value.trim();
      input.setCustomValidity(title ? '' : t('errorFavoriteName'));
      let newUrl = '';
      try {
        newUrl = favoriteUrl(address.value);
        address.setCustomValidity('');
      } catch (error) {
        address.setCustomValidity(errorMessage(error));
      }
      if (this.busy || this.locked || !form.reportValidity()) return;
      this.change(async () => {
        const favorites = await this.actions.onUpdate(url, newUrl, title);
        if (favorites && this.editor === form) this.cancelEditing(true);
        return favorites;
      });
    });
    this.editor = form;
    element('.managed-info', row).hidden = true;
    element('.managed-actions', row).hidden = true;
    row.append(form);
    input.focus();
    input.select();
  }

  private change(task: () => Promise<Favorite[] | undefined>) {
    if (this.busy || this.locked) return;
    this.busy = true;
    this.feedback.hidden = true;
    this.render(this.favorites, this.locked);
    void (async () => {
      try {
        const next = await task();
        if (next) this.favorites = next;
      } catch (error) {
        this.feedback.textContent = errorMessage(error);
        this.feedback.hidden = false;
      } finally {
        this.busy = false;
        this.render(this.favorites, this.locked);
      }
    })();
  }

  private createItem(url: string) {
    const item = document.createElement('li');
    item.className = 'managed-item';
    item.dataset.url = url;
    const info = document.createElement('div');
    info.className = 'managed-info';
    const label = document.createElement('h3');
    label.className = 'managed-label';
    const address = document.createElement('p');
    address.className = 'managed-url';
    address.textContent = url;
    info.append(label, address);
    item.append(info);
    const actions = element<HTMLTemplateElement>('#managed-actions-template');
    item.append(actions.content.cloneNode(true));
    return item;
  }

  render(favorites: Favorite[], locked = false) {
    const focused = document.activeElement as HTMLElement | null;
    const focusedRow = focused?.closest<HTMLElement>('.managed-item');
    const focusedIndex = focusedRow ? [...this.list.children].indexOf(focusedRow) : -1;
    this.favorites = favorites;
    this.locked = locked;
    const busy = this.busy || locked;
    const existing = new Map(
      [...this.list.querySelectorAll<HTMLElement>('.managed-item')].map(row => [
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
      element('.managed-label', row).textContent = label;
      const messages: Record<string, string> = {
        up: 'moveFavoriteUp',
        down: 'moveFavoriteDown',
        edit: 'editFavorite',
        remove: 'removeFavorite'
      };
      for (const button of row.querySelectorAll<HTMLButtonElement>('.managed-actions button')) {
        const action = button.dataset.action!;
        button.title = t(messages[action]);
        button.setAttribute('aria-label', `${button.title}: ${label}`);
        button.disabled =
          (action === 'up' && index === 0) || (action === 'down' && index === favorites.length - 1);
        button.setAttribute('aria-disabled', String(busy || button.disabled));
      }
    }
    for (const row of existing.values()) {
      if (row.contains(this.editor)) this.cancelEditing(false);
      row.remove();
    }
    this.empty.hidden = !!favorites.length;
    if (this.editor) {
      element<HTMLButtonElement>('[type="submit"]', this.editor).disabled = busy;
      for (const input of this.editor.querySelectorAll<HTMLInputElement>('input'))
        input.readOnly = busy;
    }
    // Moving existing nodes or a remote deletion must not strand keyboard focus.
    if (focusedIndex >= 0) {
      const row = focusedRow?.isConnected
        ? focusedRow
        : this.list.children[Math.min(focusedIndex, favorites.length - 1)];
      const action = focused?.dataset.action || 'edit';
      const replacement = [...(row?.querySelectorAll<HTMLButtonElement>('button') || [])].find(
        button =>
          button.dataset.action === action && !button.disabled && !button.closest('[hidden]')
      );
      if (focused?.isConnected && !(focused instanceof HTMLButtonElement && focused.disabled))
        focused.focus();
      else if (replacement && !replacement.disabled) replacement.focus();
      else if (row)
        (
          row.querySelector<HTMLInputElement>('input') ||
          element<HTMLButtonElement>('[data-action="edit"]', row)
        ).focus();
      else element('#favorites-heading').focus();
    }
  }
}
