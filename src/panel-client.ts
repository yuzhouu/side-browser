import type { BackgroundMessage, PanelRequests, RequestArgs, Response } from './types.js';
import { userError } from './errors.js';

// Transport only: the panel decides how incoming state affects its live iframe.
export function createPanelClient(
  windowId: number,
  onMessage: (message: BackgroundMessage) => void,
  target: () => number | null | undefined = () => undefined
) {
  let port: chrome.runtime.Port | null;
  let reconnectDelay = 250;

  async function requestFor<K extends keyof PanelRequests>(
    tabId: number | null | undefined,
    type: K,
    ...args: RequestArgs<PanelRequests[K][0]>
  ): Promise<PanelRequests[K][1]> {
    // Keep the original page and payload even if the worker needs time to start.
    const message = structuredClone({
      type,
      windowId,
      ...(tabId === undefined ? {} : { tabId }),
      ...args[0]
    });
    let response: Response<PanelRequests[K][1]> | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await chrome.runtime.sendMessage(message);
        break;
      } catch (error) {
        // Only retry a request that had no receiver. A closed response channel may
        // mean the operation already ran (for example, opening a new tab).
        if (
          !(error instanceof Error) ||
          error.message !== 'Could not establish connection. Receiving end does not exist.'
        )
          throw error;
        if (attempt === 2) throw userError('errorBackgroundUnavailable');
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
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
    port.onMessage.addListener(message => {
      reconnectDelay = 250;
      onMessage(message);
    });
    port.onDisconnect.addListener(() => {
      // Worker shutdown can close a port with lastError; reconnect is expected.
      void chrome.runtime.lastError;
      port = null;
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 5000);
    });
  }

  async function start() {
    // Reconnection must remain active even if the initial state request fails.
    connect();
    return request('PANEL_READY');
  }

  return { request, requestFor, connect, start };
}
