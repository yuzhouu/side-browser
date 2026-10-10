import { FRAME_COOKIES } from './frame-cookies.js';
import type { Response } from './types.js';

(() => {
  // Isolated world: only the panel's own top-level HTTPS document, identified by the
  // actual extension ID. Incognito frames never receive the regular profile's cookies.
  if (
    window === window.top ||
    location.ancestorOrigins.length !== 1 ||
    location.ancestorOrigins[0] !== `chrome-extension://${chrome.runtime.id}` ||
    location.protocol !== 'https:' ||
    chrome.extension?.inIncognitoContext !== false
  )
    return;
  let pending = false;
  const refresh = () => {
    if (pending) return;
    pending = true;
    chrome.runtime
      .sendMessage({ type: FRAME_COOKIES, url: location.href })
      .then(
        (response?: Response<string[]>) => {
          if (!response?.ok) return;
          const detail = JSON.stringify({ extensionId: chrome.runtime.id, cookies: response.data });
          document.dispatchEvent(new CustomEvent('pocket-frame-cookies', { detail }));
        },
        () => {}
      )
      .finally(() => {
        pending = false;
      });
  };
  document.addEventListener('pocket-frame-cookies-request', refresh);
  refresh();
})();
