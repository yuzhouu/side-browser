# 伴页 · SideBrowser

这是 Chrome Manifest V3 侧边栏浏览器扩展，当前基线版本为 1.6.5。根目录包含可直接加载的 manifest.json，无需构建。

## 开发入口

- `npm test`：运行 Node 内置测试，项目无第三方运行依赖。
- `sidepanel.html/js/css`：36px 单行导航和网页 iframe。
- `background.js`、`sidepanel-state.js`：按窗口保活、导航历史、扩展共用模式偏好。
- `viewport.js`、`frame-navigation.js`、`mobile-*.js`、`network-rules.js`：手机身份、视口适配、请求规则。
- 先阅读 `docs/project-context.md` 了解已确认的产品约束。

## 已确认的产品约束

- 使用原生 sidePanel，同一浏览器窗口共用一个运行中的网页；不同窗口的 URL／历史独立。
- 切标签、关闭来源页、后台 Service Worker 恢复不得重建网页。来源标签只提供一次 URL。
- 没有常驻辅助标签页，不使用 debugger，不改回独立弹窗或页面浮层。
- 手机模式保留桌面鼠标、悬停、滚轮和触摸点数；仅做现有视口与身份兼容，不声称完整 DevTools 设备模拟。
- 顶部顺序：后退、前进、刷新、短地址栏、打开当前网页、更多。更多内是外部新标签打开和手机／PC 切换。
- 用户可见品牌为「伴页 · SideBrowser」。内部 pocket/POCKET 标识属于持久化和通信协议，重命名时避免破坏已有状态。

修改界面时检查实际显示和受影响的交互。使用独立浏览器测试配置，区分真实侧边栏宽度和仅模拟内容视口的排版检查。既有验证记录是历史证据，不能直接当作新改动已通过的证据。
