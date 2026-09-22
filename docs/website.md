# 官网与 GitHub Pages

目标地址：https://yuzhouu.github.io/side-browser/ 。中文首页和隐私政策位于 `/`、`/privacy/`；英文对应 `/en/`、`/en/privacy/`。官网独立输出到 `site-dist/`，不混入 Chrome 扩展 `dist/`。

## 维护

- `website/content.mjs`：两种语言的功能、标签绑定与安装介绍。
- `website/styles.css`：浅深色设计系统与 320px 起的响应式排版。
- `website/app.js`：主题切换与场景预览。主题首次跟随系统，手动选择保存在网站本地存储；语言由可直接分享的 URL 决定。
- `docs/privacy-policy.md`：唯一隐私正文来源，构建时输出两种语言，无需 JavaScript 即可阅读。
- `store/zh-CN/` 与 `store/en/`：按语言分组的商店文案和图片，不在官网发布；`store/assets/source/` 保存首页使用的真实截图原图。更新原图请遵循 `store/README.md` 的采集流程。
- `scripts/site-build.mjs`：生成 HTML、SEO 元信息、站点地图、扩展下载包和首页场景截图。不会发布后台填写资料、截图采集日志或测试文件。

执行 `npm run site:build` 会先从当前源码构建扩展 ZIP，再构建官网。`npm run site:preview` 默认使用端口 4173；可用 `PORT=4179 npm run site:preview` 避开占用。`SITE_BASE_PATH` 默认 `/side-browser/`，部署到其他目录时构建与预览需使用同一值；`SITE_ORIGIN` 默认 `https://yuzhouu.github.io`。

## 自动部署

`.github/workflows/pages.yml` 使用 GitHub 官方 checkout、setup-node、configure-pages、upload-pages-artifact、deploy-pages Actions。main 推送自动执行；PR 只构建验证，不部署。也可在 Actions 页手动运行。工作流只为部署 job 授予 `pages: write` 和 `id-token: write`。

初次在仓库 Settings → Pages → Build and deployment 中把 Source 设为 GitHub Actions。此操作由仓库拥有者完成。部署成功后，商店“隐私政策”填 https://yuzhouu.github.io/side-browser/privacy/ 。网站主要安装入口指向 [Chrome 应用商店](https://chromewebstore.google.com/detail/jlankbdlgdjliaccjkhccphfjmmpgkho?utm_source=item-share-cb)，中英文首页均说明商店安装步骤；ZIP 下载和折叠的手动安装说明作为备用入口保留。

参考：[GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 公开内容

官网定位为「输入任意网址，打开自己常用的网站」。ChatGPT、维基百科与 Google 搜索仅为截图示例，不是网站支持清单；网站自身的登录与嵌入规则仍可能影响使用。首页保留主页面与侧窗的真实截图预览，并提供三种场景切换。

绑定说明先介绍默认共享，再说明可在「⋯」中选择「绑定到当前标签页」。展开「绑定后，其他标签会怎样？」可了解网页及历史移入绑定、共享页清空，以及解绑、关闭标签和浏览器重启的行为。中英文内容保持一致。

官网不再生成 `/media/`、`/en/media/`、宣传图或素材 ZIP，也不包含素材生成器。旧素材链接返回 404；商店中英文素材和制作流程独立保留在 `store/`。

`npm run site:check` 检查 4 个双语页面、404 页、本地链接与扩展 ZIP。启动预览服务后，使用 `SITE_URL=http://127.0.0.1:4179/side-browser/ CHROME_PATH=<Chrome 可执行文件> npm run site:test:browser` 检查绑定说明展开、场景／语言切换、主题跨页保持、扩展下载和 1440／768／390／320px 排版。

## 本次验证（2026-09-17）

`npm run site:build`（含扩展类型检查与打包）、`npm run site:check`、`npm run format:check` 和 `git diff --check` 通过。静态检查覆盖 5 个 HTML、81 个本地链接／锚点／资源，以及双语隐私正文与扩展 ZIP。

当前会话未提供 Browser 插件技能，使用项目现有 Playwright 脚本与独立 Chrome for Testing 配置验证 `http://127.0.0.1:4187/side-browser/`。中英文绑定说明在深浅色下均可展开／收起；4 个页面在 1440／768／390／320px 无横向溢出。场景／语言切换、跨页主题保持与扩展 ZIP 实际下载通过；旧素材页和素材 ZIP 返回 404，无控制台错误或警告。已检查桌面首页、320px 中文绑定区和英文深色绑定区截图，证据位于 `/tmp/sidebrowser-site-binding-qa/`。本次仅验证官网改动，尚未发布线上，未重新执行扩展原生侧边栏回归。

## 功能与文档补齐（2026-09-17）

中英文首页补充收藏快捷打开、网页／扩展图标右键收藏、收藏与最近列表分开保存，以及关闭网页保留绑定等规则；隐私页与当前隐私政策源文件同步，更新日期为 2026-09-17。保留本页上方记录的官网结构调整。

重新执行本地构建、静态检查和独立 Chrome 浏览器检查：5 个 HTML、81 个本地资源／锚点链接、两种语言隐私正文与扩展 ZIP 通过；中英文 4 页在 1440／768／390／320px 无横向溢出，深浅色绑定说明、场景和语言切换、主题保持、真实安装包下载均通过，无控制台错误或警告。证据位于 `/tmp/sidebrowser-docs-site-qa/`。产物仅在本地 `site-dist/`，此次尚未部署线上。

## 历史验证（2026-09-16，包含现已移除的素材页）

以下为旧版设计与上线记录，不代表当前版本的验证结果。

### 设计对照

2026-09-16，本机类型检查、54 项扩展测试、格式检查通过；官网静态检查验证 7 个 HTML、166 个本地链接／锚点／资源，以及隐私双语正文和两种下载 ZIP。

先用内置浏览器检查了桌面首页、英文深色、中文素材页、320px 隐私页、场景与语言切换、主题跨页保持、复制文案。其下载事件没有返回，随后用独立 Chrome for Testing 149 验证实际下载：3 场景 × 2 语言 × 2 主题的 12 张 PNG，以及素材 ZIP。6 个页面在 1440／768／390／320px 均无水平溢出，无控制台错误。可运行 `SITE_URL=http://127.0.0.1:4179/side-browser/ CHROME_PATH=<Chrome 可执行文件> npm run site:test:browser` 复现。临时 QA 图片位于 `/tmp/sidebrowser-website-qa/`，不作为可长期访问的产物。

设计遵循已生成并检查的完整首页概念：白色／浅蓝留白、左文右截图、黄色圆形、开放三列步骤、素材横幅与紧凑页脚。实际使用原始 SVG 品牌和原始截图；增加场景切换、本地数据说明及真实 ZIP 安装步骤；深色以海军蓝底保持结构。概念图不作为实际网页截图或产品界面发布。

### 上线确认

2026-09-16，提交 `30d0151` 的 [GitHub Actions #1](https://github.com/yuzhouu/side-browser/actions/runs/35081205181) 构建与部署均成功。未登录浏览器验证了线上首页、中英文隐私页、素材生成区、语言与主题切换。两个隐私 URL 与扩展／素材 ZIP 通过匿名 HTTP 读取，均返回 200；下载 ZIP 文件头与预期一致。当前官网：https://yuzhouu.github.io/side-browser/ 。

### 宣传图主页面对照更新（2026-09-16）

AI 商店主图和横幅改为维基百科主页面 + ChatGPT 侧窗；原有并排查资料图保留，快速打开、最近记录和外观图继续展示对应局部功能。官网首页预览与 12 种素材导出统一展示主页面和侧窗：AI／搜索场景使用番茄工作法主文章，百科场景使用时间管理主文章 + 番茄工作法侧边参考。两张主页面与原生侧栏实拍按比例组合，不伪造浏览器控件或 AI 回答。新增截图来源记录在 `store/assets/source/main-research.json`。

本次重新验证 12 张无 alpha 的 1280×800 PNG 下载、素材 ZIP、6 页 1440／768／390／320px 排版和主题保持；首页三场景切换后主页面宽度均大于侧窗两倍且相邻无覆盖。内置浏览器检查中英文素材预览与 390px 显示，无控制台错误。静态检查覆盖 168 个本地链接／锚点／资源。
