import { setTimeout as delay } from 'node:timers/promises';

export async function poll(read, label) {
  const deadline = Date.now() + 15000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await read();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`, { cause: lastError });
}

// Native side panels and their out-of-process frames are CDP targets, not tabs.
export async function attachTarget(root, targetId, diagnostics) {
  const { sessionId } = await root.send('Target.attachToTarget', { targetId, flatten: false });
  const pending = new Map();
  let sequence = 0;
  let fixtureBody;

  function finish(id, error, result) {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    clearTimeout(request.timer);
    if (error) request.reject(error);
    else request.resolve(result);
  }

  function receive(event) {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message);
    if (message.id) {
      finish(message.id, message.error && new Error(message.error.message), message.result);
    }
    if (message.method === 'Fetch.requestPaused' && fixtureBody !== undefined) {
      void target
        .send('Fetch.fulfillRequest', {
          requestId: message.params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
          body: fixtureBody
        })
        .catch(error => diagnostics.errors.push(error.message));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      diagnostics.errors.push(details.exception?.description || details.text);
    }
    if (message.method === 'Runtime.consoleAPICalled') {
      const { type, args } = message.params;
      if (type === 'error' || type === 'warning') {
        diagnostics[type === 'error' ? 'errors' : 'warnings'].push(
          args.map(arg => arg.value ?? arg.description).join(' ')
        );
      }
    }
    if (message.method === 'Log.entryAdded') {
      const { level, text } = message.params.entry;
      if (level === 'error' || level === 'warning') {
        diagnostics[level === 'error' ? 'errors' : 'warnings'].push(text);
      }
    }
  }
  root.on('Target.receivedMessageFromTarget', receive);

  const target = {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => finish(id, new Error(`CDP timeout: ${method}`)), 15000);
        pending.set(id, { resolve, reject, timer });
        root
          .send('Target.sendMessageToTarget', {
            sessionId,
            message: JSON.stringify({ id, method, params })
          })
          .catch(error => finish(id, error));
      });
    },
    // Serve deterministic content at real search URLs without contacting search providers.
    async mockResponse(patterns, body) {
      fixtureBody = Buffer.from(body).toString('base64');
      await this.send('Fetch.enable', {
        patterns: patterns.map(urlPattern => ({ urlPattern, requestStage: 'Request' }))
      });
    },
    async evaluate(expression) {
      const response = await this.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (response.exceptionDetails) {
        throw new Error(
          response.exceptionDetails.exception?.description || response.exceptionDetails.text
        );
      }
      return response.result.value;
    },
    async click(selector) {
      const position = await this.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        element.scrollIntoView({ block: 'center' });
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) throw new Error('Element is not visible');
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await this.send('Input.dispatchMouseEvent', {
          type,
          button: 'left',
          clickCount: 1,
          ...position
        });
      }
    },
    async fill(selector, value) {
      await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();
        document.querySelector(${JSON.stringify(selector)}).select()`);
      await this.send('Input.insertText', { text: value });
    },
    async press(key) {
      const codes = { Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40 };
      for (const type of ['keyDown', 'keyUp']) {
        await this.send('Input.dispatchKeyEvent', {
          type,
          key,
          code: key,
          windowsVirtualKeyCode: codes[key],
          ...(key === 'Enter' && type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {})
        });
      }
    },
    dispose() {
      root.off('Target.receivedMessageFromTarget', receive);
      for (const id of pending.keys()) finish(id, new Error('CDP target disposed'));
    },
    async detach() {
      await root.send('Target.detachFromTarget', { sessionId });
      this.dispose();
    }
  };
  await target.send('Runtime.enable');
  await target.send('Log.enable');
  return target;
}
