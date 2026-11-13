import type { PanelSnapshot } from './types.js';
import { PanelViewport } from './viewport.js';
import { RecentTitleTracker } from './recent-urls.js';
import { t } from './i18n.js';
import { sitePreference } from './site-preferences.js';

// Each page owns its browsing context. Switching pages never detaches an iframe.
export class PanelPage {
  readonly web: HTMLIFrameElement;
  readonly viewport: PanelViewport;
  tracker = new RecentTitleTracker();
  title = '';
  titleUrl = '';
  started = false;
  loading = false;
  pendingNavigation = false;
  disposed = false;
  notice = '';
  private loadingTimer?: ReturnType<typeof setTimeout>;
  // A document that finishes loading without reporting its location is a browser error
  // page: refused embedding, a network error or a blocked plugin (PDF) document.
  refused = false;
  target = '';
  documentId = '';
  reports = 0;
  checkedReports = 0;
  refusalTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly stage: HTMLElement,
    public state: PanelSnapshot,
    private changed: (page: PanelPage) => void
  ) {
    this.web = stage.querySelector('iframe')!;
    this.viewport = new PanelViewport(this.web, stage, () => this.state.mode);
    this.web.addEventListener('load', () => {
      if (this.disposed || !this.started) return;
      this.setLoading(false);
      clearTimeout(this.refusalTimer);
      // Reports cross processes and can trail the load event slightly.
      this.refusalTimer = setTimeout(() => {
        if (this.disposed || !this.started) return;
        if (this.reports === this.checkedReports) {
          this.refused = true;
          this.notice = t('pageRefused');
        }
        this.checkedReports = this.reports;
        this.changed(this);
      }, 500);
      this.changed(this);
    });
  }

  // A document in this frame reported its location.
  reported(documentId: string) {
    this.reports++;
    this.documentId = documentId;
    this.target = '';
    if (this.refused) this.notice = '';
    this.refused = false;
  }

  loaded(documentId: string) {
    if (this.disposed || !this.started || documentId !== this.documentId) return;
    clearTimeout(this.refusalTimer);
    this.target = '';
    this.setLoading(false);
    this.changed(this);
  }

  // The current document is navigating away: its successor must report before it loads,
  // even if this document's own load event never fired. Stale documents are ignored.
  leaving(url: string, documentId: string) {
    if (this.disposed || !this.started || documentId !== this.documentId) return;
    this.target = url;
    this.checkedReports = this.reports;
    clearTimeout(this.refusalTimer);
    this.refused = false;
    this.notice = '';
    this.setLoading(true);
    this.changed(this);
  }

  private setLoading(loading: boolean) {
    clearTimeout(this.loadingTimer);
    this.loading = loading;
    this.stage.setAttribute('aria-busy', String(loading));
    if (this.notice === t('loadingSlow')) this.notice = '';
    if (loading)
      this.loadingTimer = setTimeout(() => {
        if (this.disposed || !this.loading) return;
        this.notice = t('loadingSlow');
        this.changed(this);
      }, 12000);
  }

  load(url: string) {
    clearTimeout(this.refusalTimer);
    this.refused = false;
    this.target = url;
    this.checkedReports = this.reports;
    this.notice = '';
    this.title = '';
    this.titleUrl = '';
    // The old document may still report a canceled navigation while src is replaced.
    this.documentId = '';
    this.pendingNavigation = Boolean(url);
    this.started = Boolean(url);
    this.setLoading(this.started);
    this.viewport.navigate();
    if (!url) {
      // Explicit close destroys this context, including any queued old reports.
      this.web.remove();
      this.web.removeAttribute('src');
      this.stage.append(this.web);
      this.tracker = new RecentTitleTracker();
    } else {
      this.tracker.navigate(url);
      this.web.src = url;
    }
    this.changed(this);
  }

  apply(next: PanelSnapshot, reload = false) {
    next = { ...next, ...sitePreference(next.url, next.defaultMode, next.sitePreferences) };
    const previous = this.state;
    this.state = next;
    if (!next.url) {
      if (this.started) this.load('');
    } else if (
      reload ||
      !this.started ||
      previous.url !== next.url ||
      previous.requestMobile !== next.requestMobile
    ) {
      this.load(next.url);
    }
    this.viewport.apply();
    this.changed(this);
  }

  dispose() {
    this.disposed = true;
    this.setLoading(false);
    clearTimeout(this.refusalTimer);
    this.viewport.resize.disconnect();
    this.stage.remove();
  }
}
