import type { BackgroundMessage, PanelRequests, RequestArgs, Response } from './types.js';
import { userError } from './errors.js';

// Transport only: the panel decides how incoming state affects its live iframe.
export function createPanelClient(
  windowId: number,
  onMessage: (message: BackgroundMessage) => void,
  target: () => number | null | undefined = () => undefined
) {
  let port: chrome.runtime.Port | null;

  async function requestFor<K extends keyof PanelRequests>(
    tabId: number | null | undefined,
    type: K,
    ...args: RequestArgs<PanelRequests[K][0]>
  ): Promise<PanelRequests[K][1]> {
    const response: Response<PanelRequests[K][1]> | undefined = await chrome.runtime.sendMessage({
      type,
      windowId,
      ...(tabId === undefined ? {} : { tabId }),
      ...args[0]
    });
    if (!response) throw userError('errorExtensionUnavailable');
    if (!response.ok) {
      throw Object.assign(new Error(response.error), { code: response.errorCode });
    }
    return response.data;
  }

  function request<K extends keyof PanelRequests>(
    type: K,
    ...args: RequestArgs<PanelRequests[K][0]>
  ): Promise<PanelRequests[K][1]> {
    return requestFor(target(), type, ...args);
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

  return { request, requestFor, connect };
}
