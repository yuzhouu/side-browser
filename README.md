# 侧窗 · SideBrowser 1.0.0

商店上架资料见 [store/README.md](store/README.md)：效率工具分类、中英文介绍、ChatGPT／维基百科／Google 功能说明图、隐私政策和提交字段；[打开素材预览](store/index.html)。

侧窗小境，静览万象

Another page. Right beside you.

源码仓库：[yuzhouu/side-browser](https://github.com/yuzhouu/side-browser)。

原生 Chrome 侧边栏中的小浏览器。同一个浏览器窗口共用一个真实网页，切换标签、刷新主页面或关闭最初提供 URL 的标签，都不需要重新加载侧边栏 iframe。没有常驻辅助标签页，没有调试提示。

## 安装与更新

1. 需要 **Chrome 145 及以上**。本版使用 Chrome 145 的 `topDomains` 请求规则，将兼容处理限定在本扩展内。
2. 使用发布 ZIP：解压到一个固定的安装文件夹，在 `chrome://extensions` 开启开发者模式，加载该文件夹（根目录含 `manifest.json`）。从源码开发：先执行 `npm ci` 和 `npm run build`，只加载 `dist/`。
3. 升级时将新 ZIP 内容覆盖原安装文件夹，并刷新原来的扩展卡片，保留原扩展身份。不要同时启用新旧版本。过去从源码根目录加载的开发版本改用 `dist/` 后会获得新身份，旧数据不会自动转入。
4. 如果旧版注入的页面浮层仍然存在，刷新该普通网页一次。新版不再注入页面浮层。
5. 点击扩展图标打开原生侧边栏。在扩展详情中允许访问要浏览的网站。

## 使用

- 地址栏接受网址或 Google 搜索词，按 Enter 前往。
- 顶部导航为 36px 单行：打开当前网页、竖分隔线、后退、前进、刷新、较短的网址或搜索输入框和「⋯」。地址输入后按 Enter 前往。
- 地址栏右侧的时钟按钮打开「最近打开」，点击条目即可切换。保留最近主动打开的 10 个网址，显示网页标题与 favicon，标题未获取时显示域名，重复打开置顶；每条右侧可单独删除，也可一键清空；跨窗口共用并在重启后保留。仅地址输入／搜索、打开当前网页、右键、快捷键和最近条目选择会记录，网页内部跳转、重定向、刷新、模式切换与前进后退不计入。升级时不从旧导航历史补充条目。来源标签页的标题会立即保存，地址栏打开的网页加载后补全标题；已有无标题记录再次打开后补全。点击列表外部或下方网页会收起列表，单条删除时保持展开。
- 「⋯」中提供在新标签页打开侧边栏当前网页、切换手机／PC 模式；菜单浮在网页上，不压缩浏览区，可按 Escape 或点击外部收起。
- 「打开当前网页」只复制一次当前标签页的网址；之后主页面跳转、关闭都不控制侧边栏。
- 「⋯」→「关闭当前网页」卸载当前网页并返回欢迎页，侧边栏保持打开。当前窗口的前进／后退历史会清空，最近打开记录及其他窗口网页保留；关闭后重新打开侧边栏或重启浏览器不会自动恢复该网页。
- 右键顶部侧窗扩展图标或网页，选择「在侧窗中打开」即可打开当前网页；右键链接则打开该链接。也可按 `Alt + Shift + P`（Mac：`⌥ + ⇧ + P`）打开当前网页。
- 常规左键点击的 `target="_blank"` 链接尽量留在侧边栏；表单由真实网页原生提交。网站脚本弹窗或组合键操作可能另开标签页。
- Chrome 管理侧边栏的左右位置、宽度和关闭按钮；不能像页面浮层一样随意拖动。
- 界面支持简体中文、繁体中文、英文、日语、德语、法语和西班牙语，自动跟随 Chrome 界面语言，其他语言使用英文；包括扩展信息、侧边栏、右键菜单、错误提示与帮助页。

## 状态与窗口

- 同一窗口使用同一个全局 side panel，未配置任何按标签页区分的面板，也不监听标签切换来重建 iframe。
- 切换标签时保留网页运行实例、输入、滚动和页面内存；后台 Service Worker 停止／唤醒也不重建 iframe。
- 不同浏览器窗口各自拥有侧边栏网页和导航历史。手机／电脑是扩展共用偏好，切换模式会刷新已打开侧边栏的网页。
- 关闭侧边栏、关闭窗口、刷新扩展或退出浏览器后，不保证页面内存继续存在。重新打开恢复保存的网址、历史与模式；浏览器重启或新建窗口从最近保存的网页开始。
- 会话存储按窗口保存导航状态；本地存储保存恢复用的最后导航状态、最近主动打开的列表和模式。删除单条或清空最近列表不影响当前网页或前进后退历史。网页不依赖最初提供 URL 的标签。
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
| favicon | 通过 Chrome 官方 favicon 接口读取最近条目的网站图标 |
| scripting、HTTP/HTTPS 网站访问 | 在本扩展直接嵌入的网页中同步网址／视口、处理新标签链接、兼容手机身份 |
| declarativeNetRequestWithHostAccess | 本扩展侧边栏的 iframe 文档嵌入兼容及资源手机请求标识 |
| contextMenus | 扩展图标／网页／链接右键入口 |

没有 debugger、页面浮层、辅助标签页、代理服务器、遥测或远程扩展脚本。网页和搜索请求发送给用户选择的网站及搜索引擎，不向开发者上传记录。

## 源码与验证

`src/sidepanel.html/ts/css` 承载真实 iframe 和导航栏；`background.ts` 管理各窗口状态、请求规则和用户打开入口；`sidepanel-state.ts` 处理导航历史，`recent-urls.ts` 独立处理最近主动打开的 10 条网址；`viewport.ts` 解析网页视口声明、计算并应用排版与缩放；`frame-navigation.ts` 在直接嵌入网页中报告网址／视口并保留原生链接／表单行为。`mobile-profile.ts`、`mobile-identity-gate.ts`、`mobile-identity-main.ts` 提供网站启动前的手机身份兼容。

运行 `npm test` 执行单元测试。`panel-client.ts` 独立处理后台请求和端口重连，`recent-menu.ts` 独立处理最近列表的渲染、菜单与键盘焦点，页面导航仍由 `sidepanel.ts` 协调。

使用 Node 22.12+ 执行 `npm ci`。应用源码集中在 `src/`，静态 manifest、语言包和运行图标集中在 `public/`；测试、文档、设计素材和开发依赖不进入安装包。

```sh
npm run dev           # 监听源码与静态资源，重建 dist/；Chrome 中手动重新加载
npm run typecheck     # TypeScript 严格类型检查
npm run build         # 检查类型并生成可加载的 dist/
npm run package       # 构建并输出 releases/sidebrowser-1.0.0.zip
npm test              # 构建、模块测试和产物检查
npm run format:check
npx playwright install chromium
npm run test:browser  # 独立 Chrome 加载 dist/ 并执行原生侧边栏回归
```

Vite 负责三个页面和后台的模块构建，注入网页的脚本单独输出为 IIFE；`tsc` 负责类型检查。产物不含源码映射、开发客户端或第三方运行依赖。ZIP 根目录直接包含 `manifest.json`。构建目录和新安装包不提交 Git。

浏览器回归使用独立临时配置，不接触日常 Chrome 资料或登录；可用 `QA_LOCALE=zh-CN npm run test:browser` 检查中文界面。自定义浏览器路径、模块边界和回归范围见 [开发与回归](docs/development.md)。

国际化使用 Chrome 原生 `chrome.i18n`，无需额外依赖。语言包位于 `public/_locales/` 下的 `en`、`zh_CN`、`zh_TW`、`ja`、`de`、`fr`、`es` 目录，默认语言为英文。`i18n.ts` 处理页面正文、提示与无障碍标签；底层模块通过 `errors.ts` 返回错误码，由界面翻译。新增语言时复制语言包，保留全部 key 和占位符，并运行 `npm test` 检查完整性。语言由 Chrome 决定，扩展内没有独立语言开关。

图标源文件为 [`icons/sidebrowser.svg`](icons/sidebrowser.svg)，采用左蓝右黄的圆角正方形眨眼笑脸，左右宽度按黄金比例分配，中间透明 gap 同时切开色块和笑容。左眼睁开、右眼眨眼，整体占画布约 97%，各尺寸保持同一造型。修改 SVG 后运行 `npm run icons:generate` 可重新生成 16、32、48、128、256、512、1024 像素版本；需要本机 `rsvg-convert`，无需浏览器或 npm 依赖。详见 [图标说明](icons/README.md)。

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome DNR topDomains](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-topDomains)
- [Chrome 内容脚本](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

## 独立项目

本目录是 Codex 项目的源码根目录。项目交接与既有决策见 [项目说明](docs/project-context.md)，历史验证见 [验证记录](docs/verification-history.md)，当前交付包为 [`releases/sidebrowser-1.0.0.zip`](releases/sidebrowser-1.0.0.zip)，早期安装包保存在 `releases/archive/`，仅供历史归档。

## 官网与宣传素材

[官网](https://yuzhouu.github.io/side-browser/) · [English](https://yuzhouu.github.io/side-browser/en/) · [隐私政策](https://yuzhouu.github.io/side-browser/privacy/) · [宣传素材](https://yuzhouu.github.io/side-browser/media/)

官网支持中英文、浅深色；素材页可按三个场景、两种语言、两种主题生成 1280 × 800 的真实截图说明图，还提供商店图片、品牌 SVG、文案和素材 ZIP 下载。

```sh
npm run site:build       # 构建扩展 ZIP 和独立静态官网 site-dist/
npm run site:check       # 校验页面链接、图片及下载 ZIP
npm run site:preview     # 本机预览 /side-browser/
npm run site:test:browser # 服务启动后验证导出与响应式布局
```

GitHub Actions 在 main 推送后构建并部署；初次需将仓库 Settings → Pages → Source 设为 GitHub Actions。网站不进入扩展 dist/。维护与验证说明见 [官网说明](docs/website.md)。
