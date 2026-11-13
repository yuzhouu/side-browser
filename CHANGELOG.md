# 更新记录 / Changelog

## 1.3.0 — 2026-11-13

- 顶栏新增首页按钮，返回欢迎页并清空当前网页历史；地址栏右侧新增收藏星标，可直接收藏或取消收藏当前完整网址。
- 更多菜单移除收藏入口，前四项调整为关闭当前网页、在新标签页打开、在当前标签页打开、绑定到当前标签页。当前标签打开会替换本窗口正在使用的主页面。
- 在当前或新标签页成功打开后，侧窗默认返回首页并清空该网页历史，保留收藏、最近记录及绑定。设置页提供共用开关，关闭后保留侧窗网页；偏好跨窗口共用并在重启后保留。
- 时钟菜单新增「最近 / 收藏」双标签。菜单和欢迎页的编辑入口在新标签页打开收藏设置，支持编辑名称与网址、调整顺序和删除；自定义名称不会被网页标题覆盖，收藏跨窗口同步并在重启后保留。
- 搜索引擎新增 Yahoo! JAPAN 和自定义配置。自定义引擎使用名称及带 `%s` 的 HTTP(S) 搜索网址，保存后跨窗口生效，支持取消草稿和切回内置引擎。
- 网页选中文字后可通过右键菜单使用当前搜索引擎在侧窗查询，保留原网页，并沿用来源标签的共享或绑定侧窗。
- 地址栏新增加载图标，按各共享／绑定网页独立显示加载状态；完善慢加载提示、缓存恢复、取消导航和旧文档消息处理。
- 改进后台连接恢复：启动失败后持续重连，仅对明确的无接收端错误有限重试，并提供关闭再开启扩展的恢复提示。
- 更新七种语言的界面与帮助、隐私说明和开发文档；本次没有新增扩展权限。

### English

- Added a Home button that returns to the welcome screen and clears the current page's navigation history, plus an address-bar star to save or remove the current URL.
- Removed the favorite action from More and placed Close current page, Open in new tab, Open in current tab, and Bind to current tab first, in that order. Open in current tab replaces the active main page in the same window.
- After opening in the current or a new tab succeeds, the sidebar returns home and clears that page's history by default, retaining favorites, recents, and bindings. Turn off the shared setting to keep the sidebar page. The preference applies across windows and survives restarts.
- Added Recent and Favorites tabs to the clock menu. Edit opens favorite settings in a new tab to change names and URLs, reorder entries, or remove them. Custom names remain separate from page titles; favorites sync across windows and survive restarts.
- Added Yahoo! JAPAN and a custom search engine with a name and an HTTP(S) URL template using `%s`. Saved settings apply across windows, with draft cancellation and retained custom settings when switching to a built-in engine.
- Added a context-menu action to search selected webpage text in the sidebar with the selected engine, preserving the original page and its shared or bound sidebar routing.
- Added an address-bar loading indicator with independent state for each shared or bound page, and improved slow-load notices, cached-page restoration, canceled navigation, and stale-document handling.
- Improved background connection recovery with ongoing reconnection, limited retries for missing receivers, and guidance to turn the extension off and on when necessary.
- Updated the interface and help in seven languages, privacy disclosures, and development documentation. No additional extension permissions are required.

## 1.2.0 — 2026-10-09

- 窄屏布局与手机身份模拟分离：窄屏布局只调整网页宽度和缩放，保留真实浏览器身份与屏幕 API，减少身份修改引起的验证兼容问题。
- 默认网页布局改为窗口宽度。升级后默认布局统一从窗口宽度开始，各网站单独保存的布局不变；需要窄屏的网站可在更多菜单单独切换，也可在设置页改回默认窄屏。
- 更多菜单新增「请求手机版」，仅在用户为该网站主动开启时使用手机浏览器身份；如遇反复验证，可关闭此选项恢复真实身份。
- 按完整域名记住窄屏／窗口宽度和请求手机版选择，跨窗口、标签绑定和浏览器重启保留；不同子域独立设置，普通标签页不受影响。
- 设置页提供默认网页布局和网站偏好列表；设置页与更多菜单均可恢复网站默认。纯布局调整保留文档和输入；手机身份变化只重载对应网站，不新增导航历史或最近记录。
- 手机身份请求规则仅覆盖主动启用的网站，同域嵌套文档使用一致的兼容身份，第三方验证域默认保留真实身份。旧版手机模式不会自动开启「请求手机版」。
- 完善 Microsoft Edge 适配：快捷键管理跳转至宿主浏览器设置，隐藏的绑定网页保持布局以保留滚动状态。
- 修复 Facebook、WhatsApp Web 在侧窗中显示错误页：侧窗内网页的请求以文档导航的取值（`Sec-Fetch-Dest: document`）发送，避免网站仅凭请求元数据拒绝嵌入；普通标签页不变。
- 修复 Telegram Web 等网站再次打开时显示「拒绝了我们的连接请求」：网站自身 service worker 代为获取的网页仅移除 `X-Frame-Options`，不改动 CSP。
- 侧窗无法显示网页时（网站禁止嵌入、无法连接或 PDF），顶部提示原因并提供「在新标签页打开」按钮；网页内点击的链接被拒绝时，按钮打开该链接的目标网址。
- 修复 X 等网站在侧窗中显示未登录：新增 `cookies` 权限，只为侧窗中直接打开的 HTTPS 网页提供该网站自己的非 HttpOnly SameSite Cookie，与它在普通标签页中可读取的内容一致；HttpOnly Cookie 不会提供给网页，Cookie 不保存、不上传。
- 更新七种语言的界面、帮助与隐私说明；官网新增日语和自动语言选择。

「请求手机版」仍是可选兼容功能，不等于完整设备模拟，也不保证所有网站的 Cloudflare 验证或嵌入浏览均可使用。

### English

- Separated narrow-page layout from mobile identity simulation. Narrow layout changes only page width and scaling, preserving native browser identity and screen APIs to reduce verification compatibility issues caused by overrides.
- Changed the default page layout to window width. After upgrading, the default starts at window width while per-site layout choices remain; switch individual sites to narrow layout from More, or change the default back in Settings.
- Added **Request mobile site** as an explicit per-website option. Turn it off to restore native identity if verification keeps repeating.
- Remembered layout and mobile-site choices by exact hostname across windows, tab bindings, and browser restarts. Subdomains have independent preferences; ordinary browser tabs remain unaffected.
- Added a default page layout and saved website preferences in Settings, with per-site reset in Settings and the More menu. Layout-only changes retain the live document and input; identity changes reload matching sites without adding navigation history or recent entries.
- Limited mobile request rules to opted-in websites, with consistent identity in same-host nested documents and native identity on third-party verification domains by default. Existing mobile-mode preferences do not enable mobile-site requests.
- Improved Microsoft Edge compatibility with host-specific shortcut settings and retained layout for hidden bound pages to preserve scroll state.
- Fixed Facebook and WhatsApp Web showing an error page in the sidebar. Sidebar page requests now carry document fetch metadata (`Sec-Fetch-Dest: document`), so sites no longer reject them based on that header alone. Ordinary browser tabs are unaffected.
- Fixed Telegram Web and similar sites showing "refused to connect" when reopened. Pages fetched by a site's own service worker have only X-Frame-Options removed; CSP is not changed.
- When the sidebar can't display a page (embedding refused, unreachable, or a PDF), a notice explains why and offers Open in new tab. For a refused link inside a page, the button opens the link's destination.
- Fixed X and similar sites appearing signed out in the sidebar. The new `cookies` permission provides the HTTPS page opened directly in the sidebar with its own non-HttpOnly SameSite cookies, matching what it can read in a normal tab. HttpOnly cookies are never provided to the page, and cookies are not stored or uploaded.
- Updated the interface, help, and privacy disclosures in seven languages. Added Japanese and automatic language selection to the website.

**Request mobile site** remains an optional compatibility feature, not full device emulation. It does not guarantee that every website's Cloudflare verification or embedded browsing will work.

## 1.1.0 — 2026-09-22

- 地址栏新增联想：侧窗最近打开、侧窗收藏、Chrome 浏览历史和书签，按网址去重并显示来源，支持键盘与鼠标选择。
- 设置页新增搜索引擎选择：Google、Bing、百度和 DuckDuckGo；候选提供使用所选引擎搜索当前输入，结果在侧窗打开。
- 顶栏刷新按钮改为关闭当前网页，返回欢迎页并保留收藏、最近记录及其他网页。
- 地址栏获得焦点时自动全选文字，再次点击可定位光标编辑。
- 新增 `history`、`bookmarks` 权限，仅用于本机查询地址候选；不修改 Chrome 历史或书签，不上传查询结果。

### English

- Added address suggestions from SideBrowser recents and favorites, Chrome history, and bookmarks, with deduplication, source labels, and keyboard/mouse selection.
- Added a shared search engine preference: Google, Bing, Baidu, or DuckDuckGo. The suggestion list includes an explicit search action that opens results in the sidebar.
- Replaced the toolbar reload button with Close current page, returning to the welcome screen while retaining favorites, recents, and other pages.
- The address field selects all text when focused; a second click positions the caret for editing.
- Added `history` and `bookmarks` permissions for local suggestion queries. The extension does not modify Chrome history/bookmarks or upload query results.
