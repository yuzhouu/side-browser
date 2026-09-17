# 官网与 GitHub Pages

目标地址：https://yuzhouu.github.io/side-browser/ 。中文首页、隐私政策和素材页位于 `/`、`/privacy/`、`/media/`；英文对应 `/en/`、`/en/privacy/`、`/en/media/`。官网独立输出到 `site-dist/`，不混入 Chrome 扩展 `dist/`。

## 维护

- `website/content.mjs`：两种语言的公开介绍及宣传图文案。
- `website/styles.css`：浅深色设计系统与 320px 起的响应式排版。
- `website/app.js`：主题切换、场景预览、复制文案和本地 PNG 导出。主题首次跟随系统，手动选择保存在网站本地存储；语言由可直接分享的 URL 决定。
- `docs/privacy-policy.md`：唯一隐私正文来源，构建时输出两种语言，无需 JavaScript 即可阅读。
- `store/assets/`：经验证的真实截图与带功能说明的商店图片。更新原图请遵循 `store/README.md` 的采集流程。
- `scripts/site-build.mjs`：生成 HTML、SEO 元信息、站点地图、下载包和允许发布的图片。不会发布后台填写资料、截图采集日志或测试文件。

执行 `npm run site:build` 会先从当前源码构建扩展 ZIP，再构建官网。`npm run site:preview` 默认使用端口 4173；可用 `PORT=4179 npm run site:preview` 避开占用。`SITE_BASE_PATH` 默认 `/side-browser/`，部署到其他目录时构建与预览需使用同一值；`SITE_ORIGIN` 默认 `https://yuzhouu.github.io`。

## 自动部署

`.github/workflows/pages.yml` 使用 GitHub 官方 checkout、setup-node、configure-pages、upload-pages-artifact、deploy-pages Actions。main 推送自动执行；PR 只构建验证，不部署。也可在 Actions 页手动运行。工作流只为部署 job 授予 `pages: write` 和 `id-token: write`。

初次在仓库 Settings → Pages → Build and deployment 中把 Source 设为 GitHub Actions。此操作由仓库拥有者完成。部署成功后，商店“隐私政策”填 https://yuzhouu.github.io/side-browser/privacy/ 。网站提供 ZIP 安装说明，不显示尚不存在的商店安装链接。

参考：[GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 素材使用

官网与宣传资料的主要定位是「输入任意网址，打开自己常用的网站」。ChatGPT、维基百科与 Google 搜索仅为截图示例，不是网站支持清单；首页、素材选择区和导出图片均说明用户可以自行选择网站。网站自身的登录与嵌入规则仍可能影响使用。

官网 `/media/` 可选 ChatGPT／维基百科／Google 搜索，生成当前语言、当前主题的 1280×800 RGB PNG（无 alpha）。主页面与右侧侧窗放在同一个画面里，并分别标注；主标题、场景解释和三条功能说明位于截图外，截图内容保持真实且不随官网主题重新着色。原图来自中文浏览环境，英文版只翻译说明文字。生成在用户浏览器内完成，不上传数据。下载素材包包含 5 张商店说明图、2 张宣传图、图标、品牌 SVG 和中英文简介。扩展安装 ZIP 独立下载。

## 本次验证与设计对照

2026-09-16，本机类型检查、54 项扩展测试、格式检查通过；官网静态检查验证 7 个 HTML、166 个本地链接／锚点／资源，以及隐私双语正文和两种下载 ZIP。

先用内置浏览器检查了桌面首页、英文深色、中文素材页、320px 隐私页、场景与语言切换、主题跨页保持、复制文案。其下载事件没有返回，随后用独立 Chrome for Testing 149 验证实际下载：3 场景 × 2 语言 × 2 主题的 12 张 PNG，以及素材 ZIP。6 个页面在 1440／768／390／320px 均无水平溢出，无控制台错误。可运行 `SITE_URL=http://127.0.0.1:4179/side-browser/ CHROME_PATH=<Chrome 可执行文件> npm run site:test:browser` 复现。临时 QA 图片位于 `/tmp/sidebrowser-website-qa/`，不作为可长期访问的产物。

设计遵循已生成并检查的完整首页概念：白色／浅蓝留白、左文右截图、黄色圆形、开放三列步骤、素材横幅与紧凑页脚。实际使用原始 SVG 品牌和原始截图；增加场景切换、本地数据说明及真实 ZIP 安装步骤；深色以海军蓝底保持结构。概念图不作为实际网页截图或产品界面发布。

## 上线确认

2026-09-16，提交 `30d0151` 的 [GitHub Actions #1](https://github.com/yuzhouu/side-browser/actions/runs/35081205181) 构建与部署均成功。未登录浏览器验证了线上首页、中英文隐私页、素材生成区、语言与主题切换。两个隐私 URL 与扩展／素材 ZIP 通过匿名 HTTP 读取，均返回 200；下载 ZIP 文件头与预期一致。当前官网：https://yuzhouu.github.io/side-browser/ 。

## 宣传图主页面对照更新（2026-09-16）

AI 商店主图和横幅改为维基百科主页面 + ChatGPT 侧窗；原有并排查资料图保留，快速打开、最近记录和外观图继续展示对应局部功能。官网首页预览与 12 种素材导出统一展示主页面和侧窗：AI／搜索场景使用番茄工作法主文章，百科场景使用时间管理主文章 + 番茄工作法侧边参考。两张主页面与原生侧栏实拍按比例组合，不伪造浏览器控件或 AI 回答。新增截图来源记录在 `store/assets/source/main-research.json`。

本次重新验证 12 张无 alpha 的 1280×800 PNG 下载、素材 ZIP、6 页 1440／768／390／320px 排版和主题保持；首页三场景切换后主页面宽度均大于侧窗两倍且相邻无覆盖。内置浏览器检查中英文素材预览与 390px 显示，无控制台错误。静态检查覆盖 168 个本地链接／锚点／资源。
