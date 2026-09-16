import type { Mode, ParsedInput } from './types.js';
import { PHONE, mobileIdentity } from './mobile-profile.js';
export { PHONE, mobileIdentity };
import { userError } from './errors.js';
export const DEFAULTS = Object.freeze({ mode: 'mobile' });
export const isWebUrl = (url: unknown): url is string =>
  typeof url === 'string' && /^https?:\/\//i.test(url);
export const validMode = (mode: unknown): Mode => (mode === 'desktop' ? 'desktop' : 'mobile');

// URLs stay in the browser. The caller chooses the appropriate search route.
export function parseInput(raw: unknown): ParsedInput {
  const value = String(raw ?? '').trim();
  if (!value) return { kind: 'home' };
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw userError('errorInvalidCharacters');
  const explicitHttp = /^https?:\/\//i.test(value);
  const hostname =
    /^(?:localhost|(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+|\[[\da-f:]+\])(?::\d+)?(?:[/?#]|$)/iu.test(
      value
    );
  const localHost = /^(?:localhost|127\.\d+\.\d+\.\d+|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(value);
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !explicitHttp && !hostname) {
    throw userError('errorUnsupportedScheme');
  }
  if (explicitHttp || (!/\s/u.test(value) && hostname)) {
    let url;
    try {
      url = new URL(explicitHttp ? value : `${localHost ? 'http' : 'https'}://${value}`);
    } catch {
      throw userError('errorInvalidUrl');
    }
    if (!isWebUrl(url.href)) throw userError('errorHttpOnly');
    return { kind: 'url', url: url.href };
  }
  return { kind: 'search', text: value };
}
