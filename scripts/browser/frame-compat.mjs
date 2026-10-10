import assert from 'node:assert/strict';
import { poll } from './cdp.mjs';

// Sites whose own service worker answers panel navigations, and script-readable SameSite
// cookies that Chromium hides from documents framed by an extension page.
export async function checkFrameCompatibility({
  panel,
  context,
  navigate,
  frameAt,
  base,
  fixture
}) {
  await navigate(`${base}/sw-scope/register`);
  let frame = await frameAt(`${base}/sw-scope/register`);
  assert(
    await frame.evaluate(
      "navigator.serviceWorker.register('/sw-scope/sw.js').then(() => navigator.serviceWorker.ready).then(registration => Boolean(registration.active))"
    )
  );
  // The worker re-fetches the navigation itself; the response still carries X-Frame-Options.
  await navigate(`${base}/sw-scope/served`);
  frame = await frameAt(`${base}/sw-scope/served`);
  assert(await frame.evaluate('Boolean(navigator.serviceWorker.controller)'));

  const site = 'https://frame-cookies.example/';
  const cookie = (name, sameSite, httpOnly = false) => ({
    name,
    value: '1',
    domain: 'frame-cookies.example',
    path: '/',
    secure: true,
    httpOnly,
    sameSite
  });
  await context.addCookies([
    cookie('lax', 'Lax'),
    cookie('strict', 'Strict'),
    cookie('none', 'None'),
    cookie('secret', 'Lax', true)
  ]);
  // Fixture responses at a real HTTPS URL; OOP iframe requests belong to their own target.
  await panel.mockResponse([`${site}*`], fixture);
  await frame.mockResponse([`${site}*`], fixture);
  await navigate(site);
  frame = await frameAt(site);
  await poll(
    () => frame.evaluate("document.cookie.split('; ').includes('lax=1')"),
    'script-readable Lax cookie'
  );
  assert.deepEqual((await frame.evaluate('document.cookie')).split('; ').sort(), [
    'lax=1',
    'none=1',
    'strict=1'
  ]);
  console.log(
    'PASS Service-worker navigations display; panel documents read their SameSite cookies, never HttpOnly'
  );
}
