import type { PanelSnapshot } from './types.js';
import { PanelViewport } from './viewport.js';
import { RecentTitleTracker } from './recent-urls.js';
import { t } from './i18n.js';

// Each page owns its browsing context. Switching pages never detaches an iframe.
export class PanelPage {
  readonly web: HTMLIFrameElement;
  readonly viewport: PanelViewport;
  tracker = new RecentTitleTracker();
  started = false;
  pendingNavigation = false;
  disposed = false;
  notice = '';
  loadingTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly stage: HTMLElement,
    public state: PanelSnapshot,
    private changed: (page: PanelPage) => void
  ) {
    this.web = stage.querySelector('iframe')!;
    this.viewport = new PanelViewport(this.web, stage, () => this.state.mode);
    this.web.addEventListener('load', () => {
      if (!this.started) return;
      clearTimeout(this.loadingTimer);
      this.changed(this);
    });
  }

  load(url: string) {
    clearTimeout(this.loadingTimer);
    this.notice = '';
    this.pendingNavigation = Boolean(url);
    this.started = Boolean(url);
    this.viewport.navigate();
    if (!url) {
      // Explicit close destroys this context, including any queued old reports.
      this.web.remove();
      this.web.removeAttribute('src');
      this.stage.append(this.web);
      this.tracker = new RecentTitleTracker();
    } else {
      this.loadingTimer = setTimeout(() => {
        this.notice = t('loadingSlow');
        this.changed(this);
      }, 12000);
      this.tracker.navigate(url);
      this.web.src = url;
    }
    this.changed(this);
  }

  apply(next: PanelSnapshot, reload = false) {
    const previous = this.state;
    this.state = next;
    if (!next.url) {
      if (this.started) this.load('');
    } else if (
      reload ||
      !this.started ||
      previous.url !== next.url ||
      previous.mode !== next.mode
    ) {
      this.load(next.url);
    }
    this.changed(this);
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.loadingTimer);
    this.viewport.resize.disconnect();
    this.stage.remove();
  }
}
