# 伴页 · SideBrowser 1.6.5

A browser in your sidebar.

源码仓库：[yuzhouu/side-browser](https://github.com/yuzhouu/side-browser)。

原生 Chrome 侧边栏中的小浏览器。同一个浏览器窗口共用一个真实网页，切换标签、刷新主页面或关闭最初提供 URL 的标签，都不需要重新加载侧边栏 iframe。没有常驻辅助标签页，没有调试提示。

## 安装与更新

1. 需要 **Chrome 145 及以上**。本版使用 Chrome 145 的 `topDomains` 请求规则，将兼容处理限定在本扩展内。无需构建。
2. 解压 ZIP，在 `chrome://extensions` 开启开发者模式，开发时加载本项目根目录；使用发布 ZIP 时加载其中包含 `manifest.json` 的 `pocket-browser` 文件夹。
3. 升级时替换原加载目录的文件，并刷新原来的扩展卡片，保留原扩展身份。不要同时启用新旧版本。旧版网址、导航历史和模式会迁移。
4. 如果旧版注入的页面浮层仍然存在，刷新该普通网页一次。新版不再注入页面浮层。
5. 点击扩展图标打开原生侧边栏。在扩展详情中允许访问要浏览的网站。

## 使用

- 地址栏接受网址或 Google 搜索词，按 Enter 前往。
- 顶部导航为 36px 单行：后退、前进、刷新、较短的网址或搜索输入框、打开当前网页和「⋯」。地址输入后按 Enter 前往。
- 「⋯」中提供在新标签页打开侧边栏当前网页、切换手机／PC 模式；菜单浮在网页上，不压缩浏览区，可按 Escape 或点击外部收起。
- 「打开当前网页」只复制一次当前标签页的网址；之后主页面跳转、关闭都不控制侧边栏。
- 右键网页或链接，选择「在伴页中打开」；`Alt + Shift + P`（Mac：`⌥ + ⇧ + P`）打开当前网页。
- 常规左键点击的 `target="_blank"` 链接尽量留在侧边栏；表单由真实网页原生提交。网站脚本弹窗或组合键操作可能另开标签页。
- Chrome 管理侧边栏的左右位置、宽度和关闭按钮；不能像页面浮层一样随意拖动。

## 状态与窗口

- 同一窗口使用同一个全局 side panel，未配置任何按标签页区分的面板，也不监听标签切换来重建 iframe。
- 切换标签时保留网页运行实例、输入、滚动和页面内存；后台 Service Worker 停止／唤醒也不重建 iframe。
- 不同浏览器窗口各自拥有侧边栏网页和导航历史。手机／电脑是扩展共用偏好，切换模式会刷新已打开侧边栏的网页。
- 关闭侧边栏、关闭窗口、刷新扩展或退出浏览器后，不保证页面内存继续存在。重新打开恢复保存的网址、历史与模式；浏览器重启或新建窗口从最近保存的网页开始。
- 会话存储按窗口保存导航状态；本地存储保存最近网址和模式。网页不依赖最初提供 URL 的标签。
- Chrome 窗口全屏已验证可点击且不重建网页。网页元素／视频自身的全屏和其他浏览器未逐一验证。

## 手机模式与网站兼容

手机模式保留桌面鼠标、悬停、滚轮和触摸点数，适配以下显示与请求行为：

- 读取网页的 `meta viewport`，按声明的逻辑宽度排版，再等比适配侧边栏。例如 NGA 的 525px 布局在 360px 侧边栏中按约 68.6% 显示，内容不会因只压窄 iframe 而被截断。
- `width=device-width` 页面按可用手机宽度排版；没有视口声明的传统页面采用 980px 布局后缩小。可见手机区域最多 390px；侧边栏更窄时按实际宽度适配。
- 监听动态视口声明和侧边栏尺寸变化，调整现有 iframe 的尺寸与显示比例，保留网页实例。
- 为直接嵌入网页提供对应的 `screen`、`outerWidth/outerHeight`、`visualViewport` 和脚本可读的设备像素比（当前配置为 2）。手机 UA / Client Hints 在第一段网站脚本执行前提供；最终视口尺寸在文档与父侧边栏建立联系后同步。
- 手机 UA / Client Hints 请求头覆盖本扩展非标签页文档树内的网站文档、脚本、样式、图片及 fetch/XHR；普通主页面和其 iframe 不受影响。
- 切回电脑模式后移除视口适配、手机脚本与请求标识，并刷新当前网页，恢复原生设备信息。

这是扩展内的视口兼容层，没有调用 DevTools 的原生设备模拟。Chrome 底层栅格化与 CSS 分辨率／设备媒体查询仍取决于真实设备，不能保证与 DevTools 在所有网站完全一致。适配以完整显示页面宽度为准，不实现手机捏合缩放、虚拟键盘或独立视觉视口平移；复杂的 viewport 最小／最大缩放、嵌套 iframe、网站 Worker 和网站自身的早期设备缓存未统一模拟。最终屏幕信息通过消息同步，不能保证任意网站首段脚本读取到精确侧边栏尺寸。

本版与 Chrome 的 **Mobile（no touch）** 模式使用同一份 NGA 公开布局代码做对照，验证了逻辑宽度、字号、缩放比例一致，并验证鼠标命中、悬停、滚轮、输入、切标签与后台恢复。NGA 登录后的完整页面未使用用户 Cookie 验证，网站自己的登录、字体偏好仍可能影响结果。

嵌入兼容规则匹配 `tabIds: [-1]`、`topDomains: [本扩展 ID]` 与 `resourceTypes: ['sub_frame']`；仅文档响应会移除嵌入限制。手机请求头规则使用相同的扩展文档树范围，覆盖其资源请求。独立网站 Worker 没有该顶层文档归属时不在规则范围内。

- 移除 iframe 文档响应的 `X-Frame-Options`。
- 只有 CSP 含 `frame-ancestors` 时移除该次响应的整条 CSP；DNR 无法单独删除其中一个指令。其他 CSP 保留。
- 不修改 Cookie 等其他响应头，不读取或重放响应体。
- 登录权限、第三方 Cookie、内网访问、DRM、网站主动检测 iframe 等限制仍存在，不能保证任意网站都兼容。可从「⋯」在新标签页继续。

## 权限与数据

| 权限 | 用途 |
| --- | --- |
| sidePanel | 在浏览器原生侧边栏承载扩展页面 |
| tabs | 用户主动打开当前网页时读取一次 URL；「在新标签页打开」操作 |
| storage | 按窗口保存会话导航、保存最近网址和设备模式 |
| scripting、HTTP/HTTPS 网站访问 | 在本扩展直接嵌入的网页中同步网址／视口、处理新标签链接、兼容手机身份 |
| declarativeNetRequestWithHostAccess | 本扩展侧边栏的 iframe 文档嵌入兼容及资源手机请求标识 |
| contextMenus | 网页／链接右键入口 |

没有 debugger、页面浮层、辅助标签页、代理服务器、遥测或远程扩展脚本。网页和搜索请求发送给用户选择的网站及搜索引擎，不向开发者上传记录。

## 源码与验证

`sidepanel.html/js/css` 承载真实 iframe 和导航栏；`background.js` 管理各窗口状态、请求规则和用户打开入口；`sidepanel-state.js` 处理历史；`viewport.js` 解析网页视口声明、计算并应用排版与缩放；`frame-navigation.js` 在直接嵌入网页中报告网址／视口并保留原生链接／表单行为。`mobile-profile.js`、`mobile-identity-gate.js`、`mobile-identity-main.js` 提供网站启动前的手机身份兼容。

运行 `npm test` 执行单元测试。浏览器验证使用独立 Chrome for Testing 149 配置，不接触日常 Chrome 资料或登录。

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome DNR topDomains](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-topDomains)
- [Chrome 内容脚本](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

## 独立项目

本目录是 Codex 项目的源码根目录。项目交接与既有决策见 [项目说明](docs/project-context.md)，历史验证见 [验证记录](docs/verification-history.md)，当前交付包为 [`releases/sidebrowser-1.6.5.zip`](releases/sidebrowser-1.6.5.zip)，原名称的安装包保留为历史版本。
