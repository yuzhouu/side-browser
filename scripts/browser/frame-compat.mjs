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
  fixture,
  catalog,
  diagnostics
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

  // Refused pages cannot be repaired by rules; the panel offers them in a normal tab.
  const refused = `${base}/sw-scope/refused`;
  const openRefused = async expected => {
    const text = await poll(
      () =>
        panel.evaluate(
          "!document.querySelector('#notice').hidden && !document.querySelector('#notice-open').hidden && document.querySelector('#notice span').textContent"
        ),
      'refused page notice'
    );
    assert.equal(text, catalog.pageRefused.message);
    const opened = context.waitForEvent('page');
    await panel.click('#notice-open');
    const tab = await opened;
    await tab.waitForURL(expected);
    await tab.close();
  };
  // A link inside the page: the destination never becomes the panel URL.
  await frame.evaluate(
    "(() => { const link = document.createElement('a'); link.href = '/sw-scope/refused?link'; link.textContent = 'refused'; document.body.append(link); link.click(); })()"
  );
  await openRefused(`${refused}?link`);
  // A working page clears the notice (navigate() waits for it to hide).
  await navigate(`${base}/sw-scope/after-link`);
  await panel.fill('#address', refused);
  await panel.press('Enter');
  await openRefused(refused);
  await navigate(`${base}/sw-scope/after-address`);
  frame = await frameAt(`${base}/sw-scope/after-address`);
  // Chromium logs the deliberate refusals; any other error still fails the run.
  const refusalLog = `Refused to display '${base}/' in a frame because it set 'X-Frame-Options' to 'deny'.`;
  assert(diagnostics.errors.includes(refusalLog));
  diagnostics.errors.splice(
    0,
    diagnostics.errors.length,
    ...diagnostics.errors.filter(error => error !== refusalLog)
  );

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
    'PASS Service-worker navigations display; refused pages offer a new tab; panel documents read their SameSite cookies, never HttpOnly'
  );
}
