import { mobileIdentity } from './mobile-profile.js';
(() => {
  // This runs in the extension's isolated world. Scope the compatibility layer
  // using the actual extension ID; ordinary site frames cannot claim it.
  if (
    window === window.top ||
    location.ancestorOrigins[0] !== `chrome-extension://${chrome.runtime.id}`
  )
    return;
  const detail = JSON.stringify({
    extensionId: chrome.runtime.id,
    identity: mobileIdentity(navigator.userAgent)
  });
  const reply = () =>
    document.dispatchEvent(new CustomEvent('pocket-mobile-profile-ready', { detail }));
  // Either world may initialize first. The synchronous request/reply plus this
  // initial event ensure both finish before the page's first parser script.
  document.addEventListener('pocket-mobile-profile-request', reply, { once: true });
  reply();
})();
