# 侧窗 · SideBrowser

这是 Chrome Manifest V3 侧边栏浏览器扩展，当前基线版本为 1.0.0。应用源码位于 `src/`，使用 TypeScript strict 和 Vite 构建；Chrome 只加载 `dist/`。

## 开发入口

- `npm run dev`：监听源码和静态资源，重新生成 `dist/`；修改后在 Chrome 重新加载扩展。
- `npm run typecheck` / `npm run build`：严格类型检查／生成干净的扩展产物。
- `npm run package`：构建并将 `dist/` 内容打包到 `releases/sidebrowser-<版本>.zip`，ZIP 根目录有 manifest.json。
- `npm test`：构建后运行 Node 内置测试及产物检查；项目无第三方运行依赖。
- `npm run format:check` / `npm run format`：检查／统一源码格式；开发工具使用 `npm ci` 安装。
- `npm run test:browser`：构建并加载 `dist/`，运行独立 Chrome 原生侧边栏回归；环境准备及范围见 `docs/development.md`。
- `src/sidepanel.html/ts/css`：36px 单行导航和网页 iframe。
- `panel-client.ts`、`recent-menu.ts`：后台通信与重连、最近列表 UI 和键盘焦点；导航和存储规则留在各自模块。
- `background.ts`、`sidepanel-state.ts`：按窗口保活、导航历史、扩展共用模式偏好。
- `viewport.ts`、`frame-navigation.ts`、`mobile-*.js`、`network-rules.ts`：手机身份、视口适配、请求规则。
- 先阅读 `docs/project-context.md` 了解已确认的产品约束。

`public/` 只放 manifest、语言包和运行图标，源码、测试、文档、设计素材和依赖不得进入产物。新增注入脚本时同步更新 `scripts/build.ts` 的独立 IIFE 入口；后台仍为 ES module。`src/types.ts` 维护消息、窗口状态和设置的共用类型。

## 已确认的产品约束

- 使用原生 sidePanel，默认同一浏览器窗口共用一个运行中的网页；不同窗口的 URL／历史独立。用户可在更多菜单将当前侧窗绑定到某个标签页；只有已绑定标签使用独立网页实例和历史，所有未绑定标签继续共享。绑定会移走当前共享网页并清空共享网址／历史，未绑定标签回到欢迎页。没有全局独立模式。
- 切标签、后台 Service Worker 恢复不得重建网页。未绑定标签关闭来源页仍保留共享侧窗；关闭已绑定标签会释放对应网页。来源标签只提供一次 URL。
- 没有常驻辅助标签页，不使用 debugger，不改回独立弹窗或页面浮层。
- 手机模式保留桌面鼠标、悬停、滚轮和触摸点数；仅做现有视口与身份兼容，不声称完整 DevTools 设备模拟。
- 顶部顺序：打开当前网页、竖分隔线、后退、前进、刷新、短地址栏、更多。更多内是外部新标签打开和手机／PC 切换。
- 用户可见品牌为「侧窗 · SideBrowser」，中文 slogan 为「侧窗小境，意赴遐荒」，英文 slogan 为 “Another page. Right beside you.”。内部 pocket/POCKET 标识属于持久化和通信协议，重命名时避免破坏已有状态。

修改界面时检查实际显示和受影响的交互。使用独立浏览器测试配置，区分真实侧边栏宽度和仅模拟内容视口的排版检查。既有验证记录是历史证据，不能直接当作新改动已通过的证据。
