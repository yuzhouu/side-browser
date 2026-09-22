# Microsoft Edge 发布

Chrome 与 Edge 共用源码、`public/manifest.json`、`dist/` 和 `sidebrowser-<版本>.zip`。无需复制项目或维护第二套版本；现有 `npm run release` 仍只生成最新的一个通用 ZIP。Edge Add-ons 尚未上架。

## 兼容边界

- 使用桌面版 Edge，底层 Chromium 至少为 145。保留 `minimum_chrome_version: "145"`：请求规则依赖 `topDomains` 限定本扩展的侧栏请求，不能为兼容旧版而去掉此限制。Edge 支持该 manifest 字段。
- 使用原生 `chrome.sidePanel` 和同一个全局侧栏。标签绑定由侧栏内部页面实例管理，不使用逐标签 `sidePanel.setOptions`；切换标签、绑定与后台恢复仍需验证网页实例保留。
- 快捷键管理在 Edge 打开 `edge://extensions/shortcuts`，Chrome 打开 `chrome://extensions/shortcuts`。扩展 API 命名空间、扩展协议、持久化键及消息保持兼容。
- 手机模式统一呈现现有 Android Chrome 兼容身份，不模拟 Edge Android，也不承诺完整设备模拟。
- `npm test` 后按 [开发与回归](development.md) 分别运行 Chrome、Edge 原生侧栏测试。登录网站、第三方 Cookie 与任意网站嵌入行为不由本地固定页面回归保证。

## 上架准备

1. 使用 Microsoft 账号在 Partner Center 注册免费的 Microsoft Edge 开发者账户并完成验证。
2. 运行 `npm run release`，上传通用 ZIP。当前 manifest 没有 `update_url` 或写死的商店扩展 ID。
3. 以 `store/submission.md` 的实际功能和权限用途为底稿，另填 Edge 商品介绍及隐私表单；将其中的 Chrome 专属称呼改成 Edge。不要直接改动 Chrome 商店原有提交资料。
4. 当前界面支持七种语言，商店营销资料只有英文与简体中文；按 Partner Center 实际列出的语言补齐必填介绍和图标，或调整商店展示语言。截图应重新采集 Edge 实际界面。
5. 现有 1280×800 截图、440×280 小宣传图、1400×560 大宣传图尺寸可复用，图标至少 128×128，官方推荐 300×300。素材内容需与待提交版本一致。
6. 更新并部署官网隐私政策，确认公开链接可访问。填写单一用途、各项权限原因、数据用途及远程代码声明，特别说明历史／书签仅在本地用于地址联想，网页内容由用户选择的网站提供。
7. 提交审核。获批后再添加真实的 Edge 商店链接；两个商店分别审核、发布更新。扩展在不同浏览器中的收藏、最近记录与偏好分别保存，不自动迁移或同步。

## Single purpose description（单一用途，可直接粘贴）

此字段填写扩展用途，不填写官网网址。官网链接放在 Website 字段，隐私政策链接放在 Privacy policy URL 字段。

SideBrowser lets users open and browse a website of their choice in Microsoft Edge’s native sidebar, alongside their current tab. Navigation, favorites, recent pages, and display settings all support this single side-by-side browsing purpose.

## 官方参考

- [Chrome 扩展迁移到 Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
- [Edge manifest 字段](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/manifest-format)
- [Edge 原生侧栏与已知问题](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar)
- [开发者注册](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)
- [上架要求](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
