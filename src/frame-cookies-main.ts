import { MAX_FRAME_COOKIES } from './frame-cookies.js';

(() => {
  const parentOrigin = location.ancestorOrigins[0];
  if (
    window === window.top ||
    location.ancestorOrigins.length !== 1 ||
    !parentOrigin?.startsWith('chrome-extension://') ||
    location.protocol !== 'https:'
  )
    return;
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  const nativeGet = descriptor?.get;
  if (!descriptor || !nativeGet) return;
  const pageDocument = document;
  let supplied: string[] = [];
  let installed = false;
  let requested = -Infinity;
  // Reads refresh the supplied cookies at most once a second; native writes are unchanged.
  const refresh = () => {
    const now = performance.now();
    if (now - requested < 1000) return;
    requested = now;
    pageDocument.dispatchEvent(new Event('pocket-frame-cookies-request'));
  };
  function apply(event: CustomEvent<string>) {
    let data: { extensionId?: unknown; cookies?: unknown };
    try {
      data = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (
      typeof data.extensionId !== 'string' ||
      !/^[a-p]{32}$/.test(data.extensionId) ||
      parentOrigin !== `chrome-extension://${data.extensionId}` ||
      !Array.isArray(data.cookies) ||
      !data.cookies.every(cookie => typeof cookie === 'string')
    )
      return;
    supplied = data.cookies.slice(0, MAX_FRAME_COOKIES);
    if (installed) return;
    installed = true;
    Object.defineProperty(Document.prototype, 'cookie', {
      ...descriptor,
      get(this: Document) {
        const value: string = nativeGet!.call(this);
        if (this !== pageDocument) return value;
        refresh();
        const visible = new Set(value ? value.split('; ') : []);
        const hidden = supplied.filter(cookie => !visible.has(cookie));
        return hidden.length ? [value, ...hidden].filter(Boolean).join('; ') : value;
      }
    });
  }
  pageDocument.addEventListener('pocket-frame-cookies', apply);
})();
