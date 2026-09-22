import assert from 'node:assert/strict';
import { join } from 'node:path';
import { poll } from './cdp.mjs';

export async function checkSearchEngine({
  panel,
  context,
  extension,
  state,
  navigate,
  loaded,
  frameAt,
  screenshot,
  base,
  fixture,
  output,
  catalog
}) {
  const options = await context.newPage();
  await options.goto(`${extension}/options.html`);
  await poll(() => options.locator('#search-engine').isEnabled(), 'search engine setting ready');
  assert.equal(await options.locator('#search-engine').inputValue(), 'google');
  await navigate(`${base}/search-settings`);
  let frame = await frameAt(`${base}/search-settings`);
  const token = await frame.evaluate('window.token');
  const before = await state();
  await panel.fill('#address', '侧窗 & 搜索');
  const label = () =>
    panel.evaluate(
      "document.querySelector('.address-option[data-kind=search] .recent-label')?.textContent"
    );
  await poll(async () => (await label())?.includes('Google'), 'default search action');
  await options.locator('#search-engine').selectOption('baidu');
  await poll(async () => (await state()).searchEngine === 'baidu', 'search engine broadcast');
  assert.equal(await frame.evaluate('window.token'), token);
  assert.equal((await state()).url, before.url);
  assert.deepEqual((await state()).history, before.history);
  // Bring the panel input back into focus after switching to the settings tab.
  await panel.fill('#address', '侧窗 & 搜索');
  await poll(
    async () => (await label())?.includes(catalog.searchEngineBaidu.message),
    'selected engine action'
  );
  await screenshot('search-action-native');
  await options.reload();
  await poll(() => options.locator('#search-engine').isEnabled(), 'search preference restored');
  assert.equal(await options.locator('#search-engine').inputValue(), 'baidu');
  const session = await context.newCDPSession(options);
  for (const width of [960, 320]) {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 850,
      deviceScaleFactor: 1,
      mobile: false
    });
    assert(await options.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    await options.screenshot({
      path: join(output, `search-settings-${width}.png`),
      fullPage: true
    });
  }
  await session.send('Emulation.clearDeviceMetricsOverride');

  const engines = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    baidu: 'https://www.baidu.com/s?wd=',
    duckduckgo: 'https://duckduckgo.com/?q='
  };
  const patterns = Object.values(engines).map(prefix => `${prefix}*`);
  await panel.mockResponse(patterns, fixture);
  for (const [engine, prefix] of Object.entries(engines)) {
    await options.locator('#search-engine').selectOption(engine);
    await poll(async () => (await state()).searchEngine === engine, 'engine applied');
    const query = `侧窗 & search ${engine}`;
    const expected = prefix + encodeURIComponent(query);
    // OOP iframe requests belong to their own CDP target.
    await frame.mockResponse(patterns, fixture);
    await panel.fill('#address', query);
    await poll(async () => Boolean(await label()), 'search action visible');
    if (engine === 'google') await panel.press('Enter');
    else if (engine === 'bing') {
      await panel.press('ArrowDown');
      await panel.press('Enter');
    } else await panel.click('.address-option[data-kind=search]');
    frame = await loaded(expected);
    assert.equal((await state()).recentUrls[0], expected);
    assert.equal(await frame.evaluate('location.href'), expected);
  }
  // URL input still navigates normally, while the explicit action searches that URL as text.
  await frame.mockResponse(patterns, fixture);
  await panel.fill('#address', 'example.com/docs');
  await panel.click('.address-option[data-kind=search]');
  frame = await loaded(engines.duckduckgo + encodeURIComponent('example.com/docs'));
  await navigate(`${base}/search-close`);
  const closing = await state();
  await panel.click('#close-current');
  await poll(
    () => panel.evaluate("!document.querySelector('#empty').hidden"),
    'toolbar close returns to welcome'
  );
  const closed = await state();
  assert.equal(closed.url, '');
  assert.deepEqual(closed.history, []);
  assert.deepEqual(closed.recentUrls, closing.recentUrls);
  assert.deepEqual(closed.favorites, closing.favorites);
  assert(
    await panel.evaluate(
      "document.querySelector('#close-current').disabled && !document.querySelector('#web').hasAttribute('src') && !document.querySelector('#address-suggestions').matches(':popover-open')"
    )
  );
  await screenshot('toolbar-close-welcome');
  await options.close();
  console.log(
    'PASS Search engine settings, persistence, live updates without reload, all four search URLs in iframe (fixture responses), plain Enter/search action and toolbar close'
  );
}
