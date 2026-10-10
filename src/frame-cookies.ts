// Chromium sends SameSite=Lax/Strict (including Lax-by-default) cookies with requests
// from a website framed by an extension page, yet hides them from that page's
// document.cookie. Sites such as X read their CSRF token there and appear signed out.
// The panel's top-level HTTPS document receives only what a normal tab could read.

export const FRAME_COOKIES = 'FRAME_COOKIES';
export const MAX_FRAME_COOKIES = 180;

export function frameCookieUrl(url: unknown, origin: string | undefined) {
  if (typeof url !== 'string' || !origin) return null;
  try {
    const target = new URL(url);
    return target.protocol === 'https:' && target.origin === origin ? target.href : null;
  } catch {
    return null;
  }
}

export function scriptHiddenCookies(cookies: chrome.cookies.Cookie[]) {
  return cookies
    .filter(
      cookie => !cookie.httpOnly && cookie.sameSite !== 'no_restriction' && !cookie.partitionKey
    )
    .slice(0, MAX_FRAME_COOKIES)
    .map(cookie => (cookie.name ? `${cookie.name}=${cookie.value}` : cookie.value));
}
