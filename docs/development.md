# 开发与回归

扩展仍直接加载项目根目录，不需要构建，也没有第三方运行依赖。Node 测试使用内置测试器；Prettier 和 Playwright 只用于开发检查。

## 常用命令

```sh
# Node 20+；安装锁定版本的开发工具
npm ci

# 单元测试无需安装开发依赖，也可以单独执行
npm test

npm run format
npm run format:check

# 首次运行浏览器回归时安装配套 Chrome for Testing
npx playwright install chromium
npm run test:browser
QA_LOCALE=zh-CN npm run test:browser
# 可选语言：en、zh-CN、zh-TW、ja、de、fr、es
QA_LOCALE=fr npm run test:browser
```

浏览器回归需要图形桌面（Linux CI 可使用 Xvfb），以检查真实原生 side panel。脚本每次创建独立临时配置，不使用日常 Chrome 资料或登录数据；本地测试服务器只监听 `127.0.0.1`。结束时关闭浏览器、服务器并删除测试配置，截图保留在终端输出的临时目录。

可通过环境变量指定已安装的 **Chrome for Testing / Chromium 145+** 和截图目录：

```sh
CHROME_PATH='/absolute/path/to/chrome' QA_OUTPUT_DIR=/tmp/sidebrowser-qa npm run test:browser
```

macOS 应指向 `.app/Contents/MacOS/Google Chrome for Testing` 可执行文件。脚本会在临时配置中生成启动包装脚本，以应用指定的 Chrome 界面语言。普通发行版 Chrome 对命令行加载未打包扩展的限制可能不同，请使用测试版浏览器。

## 模块边界

| 模块 | 负责内容 |
| --- | --- |
| `sidepanel.js` | 页面初始化、导航、iframe 生命周期、状态更新与操作串行化 |
| `options.html` / `options.js` / `help.html` | 设置、最近记录清理、快捷键入口与面向用户的帮助 |
| `theme-preference.js` / `theme.js` / `theme.css` | 共用外观偏好、存储变化监听与浅色／深色配色；通过原生 `color-scheme` 传递网页偏好 |
| `panel-client.js` | 带窗口 ID 的请求、错误码还原、消息端口与断线重连 |
| `recent-menu.js` | 最近列表的 DOM、图标、菜单收起、键盘与删除后焦点 |
| `sidepanel-state.js` / `recent-urls.js` | 导航历史、最近列表和标题关联的独立数据规则 |
| `background.js` | 持久化、窗口状态、跨窗口广播、浏览器入口与兼容规则注册 |
| `viewport.js` / `frame-navigation.js` / `mobile-*.js` / `network-rules.js` | 网页内导航、手机视口、身份和请求兼容 |

最近菜单通过回调请求打开、删除或清空；它不直接写存储或管理导航历史。通信模块只传递消息，收到后台重连消息是否加载 iframe，仍由侧边栏入口判断。所有最近条目操作继续使用同一个串行队列，避免删除和导航交错写回旧状态。

设置页通过 `SETTINGS_GET`、`SETTINGS_MODE`、`SETTINGS_THEME` 和 `SETTINGS_CLEAR_RECENT` 请求后台，在同一串行队列中读写模式、外观与最近记录。仅接受扩展自身 `options.html` 的设置请求；侧边栏的导航请求仍要求真实原生 side panel 上下文。设置页监听本地存储变化更新显示，不直接写存储。帮助页不承载设置写入，也不展示开发与验证记录。

外观由 `theme.js` 监听 `pocket-theme-v1`，所有扩展页面共用 `theme.css`。默认 `color-scheme: light dark` 跟随系统，手动选项设为 `light` 或 `dark`；CSS 自动处理系统变化和网页内的 `prefers-color-scheme`，不注入改色样式或覆写网页 API，也不触发导航与重载。侧边栏「更多」中的三个外观选项通过 `PANEL_THEME` 请求同一个后台写入函数，保留原生侧边栏来源校验；选中标记随存储变化更新，与设置页双向同步。

## 浏览器回归范围

`scripts/browser-smoke.mjs` 使用 Playwright 启动浏览器，并通过 CDP 操作原生侧边栏和跨进程 iframe；测试页面及 CDP 辅助代码位于 `scripts/browser/`。

- 页面身份、语言、空态、顶部控件顺序、扩展介绍及工具栏标题、已翻译的错误提示。
- 帮助页全部文案且不显示版本号；960px 和 320px 模拟内容视口无横向溢出。
- Chrome 选项入口打开设置页，设置与帮助互相导航、快捷键管理入口、设置自动保存与刷新恢复；960px 和 320px 设置布局。
- 设置页与侧边栏模式双向同步、跨窗口生效；清空记录的取消与确认、当前网页实例和窗口历史保留、浏览器重启后模式恢复。
- 浅色／深色设置和帮助页的 960px／320px 排版；默认跟随系统、手动覆盖、系统偏好动态切换、更多菜单与设置页双向同步、跨窗口同步及浏览器重启后外观恢复。原生侧边栏内网页的 CSS 和媒体查询监听器响应切换，文档实例、输入与历史保留，普通标签页的主题偏好不变。
- 打开当前网页后切标签、关闭来源页，输入和文档实例保持。
- 停止后台 Service Worker，等待新的 worker 自动启动，现有 iframe 不重建。
- 内部链接、前进后退、刷新、重定向与标题归属。
- 手机／PC 切换时按设计重载，不新增最近条目。
- 动态标题、最近条目选择、键盘移动、单条删除后的焦点与菜单保持。
- 原生侧边栏截图；480px 和 320px **模拟内容视口**的工具栏、最近菜单和更多菜单文案边界检查。320px 不代表 Chrome 原生侧边栏支持该宽度。
- 点击内嵌网页收起最近列表和更多菜单；点击更多菜单内的分组标题保留展开，点击菜单外的工具栏控件或再次点击更多按钮收起；跨窗口最近列表同步和清空不改变各自 URL／当前页面。
- 完整浏览器重启后恢复最近条目。
- 捕获页面与后台运行错误；只允许脚本中列明的既有 Chromium 提示。

测试使用本地固定页面，不验证登录网站、账号 Cookie、任意网站的嵌入兼容性或全部设备模拟边界。新的功能需要增加对应行为检查；历史截图和验证记录不能替代当前执行结果。

## 错误处理

面板发起的请求失败由 UI 显示已翻译的错误。没有直接 UI 调用方的初始化、窗口状态清理、右键菜单安装和手势打开失败，使用 `[SideBrowser]` 前缀与操作名称写入后台控制台。

端口在发送前关闭、后台停止导致断线、旧浮层内容脚本已不存在，属于预期恢复路径，代码注明原因。队列内部的 `catch` 只使后续任务能够继续执行，原始请求的错误仍交给调用方处理。
