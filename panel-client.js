import { userError } from './errors.js';

// Transport only: the panel decides how incoming state affects its live iframe.
export function createPanelClient(windowId, onMessage) {
  let port;

  async function request(type, data = {}) {
    const response = await chrome.runtime.sendMessage({ type, windowId, ...data });
    if (!response) throw userError('errorExtensionUnavailable');
    if (!response.ok) {
      throw Object.assign(new Error(response.error), { code: response.errorCode });
    }
    return response.data;
  }

  function connect() {
    if (port) return;
    port = chrome.runtime.connect({ name: `pocket-sidepanel:${windowId}` });
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(() => {
      // Worker shutdown can close a port with lastError; reconnect is expected.
      void chrome.runtime.lastError;
      port = null;
      setTimeout(connect, 250);
    });
  }

  return { request, connect };
}
