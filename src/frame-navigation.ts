(() => {
  if (window === top || location.ancestorOrigins[0] !== `chrome-extension://${chrome.runtime.id}`)
    return;
  if (globalThis.__pocketNativeLinks) return;
  globalThis.__pocketNativeLinks = true;
  const origin = `chrome-extension://${chrome.runtime.id}`;
  const documentId = Array.from(crypto.getRandomValues(new Uint32Array(4)), n =>
    n.toString(16)
  ).join('-');
  const viewport = () =>
    Array.from(document.querySelectorAll('meta'))
      .filter(meta => meta.name.toLowerCase() === 'viewport')
      .slice(0, 64)
      .map(meta => meta.content.slice(0, 4096));
  const report = (type = 'POCKET_LOCATION') =>
    parent.postMessage(
      {
        type,
        url: location.href,
        title: document.title.slice(0, 512),
        documentId,
        viewport: viewport()
      },
      origin
    );
  report();
  let lastViewport = JSON.stringify(viewport()),
    lastTitle = document.title;
  const observeMetadata = () => {
    const next = JSON.stringify(viewport());
    if (next !== lastViewport) {
      lastViewport = next;
      report('POCKET_VIEWPORT');
    }
    if (document.title !== lastTitle) {
      lastTitle = document.title;
      report('POCKET_TITLE');
    }
  };
  // Observe metadata, not the frequently changing website body.
  const headObserver = new MutationObserver(observeMetadata);
  const watchHead = () => {
    if (!document.head) return false;
    headObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['name', 'content']
    });
    observeMetadata();
    return true;
  };
  if (!watchHead()) {
    const start = new MutationObserver(() => {
      if (watchHead()) start.disconnect();
    });
    start.observe(document, { childList: true, subtree: true });
  }
  addEventListener('pageshow', () => {
    report();
    // Restoring a cached document does not necessarily fire the iframe load event.
    report('POCKET_LOADED');
  });
  addEventListener('popstate', () => report());
  addEventListener('hashchange', () => report());
  window.navigation?.addEventListener('currententrychange', () => report());
  // A refused destination becomes a browser error page without this script, so tell the
  // panel where a cross-document navigation is going before this document unloads.
  let navigating: NavigateEvent | null = null;
  window.navigation?.addEventListener('navigate', event => {
    const url = event.destination.url;
    if (
      event.destination.sameDocument ||
      event.downloadRequest !== null ||
      event.defaultPrevented ||
      !/^https?:/i.test(url)
    )
      return;
    navigating = event;
    parent.postMessage({ type: 'POCKET_LEAVING', url, documentId }, origin);
    event.signal.addEventListener(
      'abort',
      () => {
        if (navigating !== event) return;
        navigating = null;
        if (document.readyState === 'complete') report('POCKET_LOADED');
      },
      { once: true }
    );
  });
  window.navigation?.addEventListener('navigatesuccess', () => {
    // A site may intercept a cross-document navigation and finish in this document.
    if (navigating && document.readyState === 'complete') report('POCKET_LOADED');
    navigating = null;
  });
  document.addEventListener(
    'click',
    event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      const link = event.composedPath().find(node => node instanceof HTMLAnchorElement);
      if (!link || !/^https?:/i.test(link.href) || link.hasAttribute('download')) return;
      const target =
        link.getAttribute('target') ||
        document.querySelector('base[target]')?.getAttribute('target');
      if (!target || target === '_self') return;
      const previous = link.getAttribute('target');
      link.setAttribute('target', '_self');
      setTimeout(() => {
        if (previous === null) link.removeAttribute('target');
        else link.setAttribute('target', previous);
      }, 0);
    },
    true
  );
})();
