# 项目交接

## 当前基线

伴页 · SideBrowser 1.6.5，从原会话工作区的 `outputs/pocket-browser` 复制成独立项目。原始位置：`/Users/yuzhou/Documents/Codex/2026-09-14/new-chat`。已交付安装包保存在 `releases/sidebrowser-1.6.5.zip`；原会话的源码和安装包仍保留。英文品牌已统一为 `SideBrowser`，npm 包名为 `sidebrowser-extension`，英文介绍为 “A browser in your sidebar.”。旧名称安装包 `releases/sidebrowse-1.6.5.zip` 仅作历史归档。

## 使用与开发

本地源码加载目录继续使用 `sidebrowse`，发布 ZIP 内的加载目录继续使用 `pocket-browser`，以保留既有加载路径；它们不作为用户可见品牌。

在本目录运行 `npm test`。无需安装依赖或构建。开发时在 Chrome 145+ 的扩展管理页面加载本项目根目录。既有安装若希望保留同一个扩展身份和数据，应继续覆盖原加载目录并点击重新加载；直接加载新路径会被 Chrome 视为另一个未打包扩展。

导航支持网址和搜索。顶部「打开当前网页」复制主标签 URL 到侧边栏；更多菜单中的「在新标签页打开当前网页」把侧边栏 URL 打开到普通标签。手机／PC 是所有侧边栏共用偏好，主动切换模式按设计重载网页。

源码支持简体中文和英文，使用 Chrome 原生 `chrome.i18n` 自动跟随浏览器界面语言，英文为兜底语言。语言包位于 `_locales/en` 和 `_locales/zh_CN`；`i18n.js` 翻译正文、提示和无障碍标签，底层模块返回稳定错误码。扩展内没有独立语言开关。浏览器重启时同步右键菜单语言。`releases/sidebrowser-1.6.5.zip` 是国际化接入前的历史安装包；验证当前源码请加载项目根目录。

## 已验证与边界

现有源码有 25 项 Node 测试，包含语言包完整性、占位符、消息引用和错误码翻译检查。此前使用独立 Chrome for Testing 149 验证过原生侧边栏、导航、标签切换保活、后台停止与恢复、窗口全屏、模式与请求隔离，以及 NGA 原始公开布局代码的视口比例。逐版本记录见 `verification-history.md`，其中临时截图和脚本路径可能在后续失效。

NGA 登录后的完整网页没有使用用户 Cookie 验证。附件中的 curl 请求包含会话和潜在写入请求，未复制到此项目。手机模式是扩展兼容层，不是完整 DevTools 设备模拟；CSS 设备分辨率、底层渲染、嵌套 iframe 和网站 Worker 等仍有边界。原生侧边栏的外框及拖动宽度下限由 Chrome 管理。

## 当前范围

本项目已从原会话复制为独立 Codex 项目，并完成 SideBrowser 品牌名称统一；源码远程仓库为 [yuzhouu/side-browser](https://github.com/yuzhouu/side-browser)，SSH 地址为 `git@github.com:yuzhouu/side-browser.git`，默认分支为 `main`；未发布到扩展商店，也没有新增产品功能。后续开发从当前源码和本交接说明继续。
