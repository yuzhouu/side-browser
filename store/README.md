# 侧窗 · SideBrowser 商店资料

分类定位：**效率工具**。主线：输入任意网址，在侧边打开用户自己常用的网站，让主页面的工作继续。**ChatGPT、维基百科与 Google 搜索仅为使用示例**，不限定用户的网站选择；网站登录与嵌入限制仍可能影响可用性。AI 截图仅使用用户指定的 ChatGPT。

## 直接使用

打开 `index.html` 预览所有成品。`assets/01-…05-….png` 为 5 张 1280×800 功能说明图；每张包含真实截图、场景标题和功能说明。上传成品 PNG，不要上传 `assets/source/` 中的原始截图。

| 文件 | 用途 |
| --- | --- |
| `listing.zh-CN.md` / `listing.en.md` | 可复制的中英文商店字段与正文 |
| `submission.md` | 分类映射、权限用途、隐私披露、审核说明、发布剩余步骤 |
| `../docs/privacy-policy.md` | 可公开发布的中英文隐私政策 |
| `assets/01-ai-beside-you.png` | 在侧边使用 ChatGPT，手动提问，切标签时继续运行 |
| `assets/02-research-in-context.png` | 维基百科与 Google 并排查资料 |
| `assets/03-open-in-one-step.png` | 打开当前网页、右键入口、快捷键与导航栏 |
| `assets/04-recent-pages.png` | 最近 10 条、快速重开、删除与清空 |
| `assets/05-make-it-yours.png` | 手机／电脑视图、深浅色、新标签继续 |
| `assets/promo-small-440x280.png` | 必填的小宣传图，品牌与侧边浏览图形 |
| `assets/promo-marquee-1400x560.png` | 可选大横幅，品牌、说明文字与 ChatGPT 实拍 |
| `assets/store-icon-128.png` | 商店上传图标；同一品牌 SVG，图形约 96px，外围透明留白 |
| `assets/manifest.json` | 最终导出尺寸与 SHA-256 |
| `assets/source/capture.json` | 实拍浏览器、日期、原生尺寸与网页来源 |
| `../releases/sidebrowser-1.0.0.zip` | 可上传的扩展安装包，根目录是 manifest.json |
| `../releases/sidebrowser-store-1.0.0.zip` | 包含文案、图片、来源与扩展 ZIP 的资料总包；它本身不是扩展安装包 |

## 截图来源与内容边界

截图来自独立临时配置中的 Chrome for Testing，加载当前项目 `dist/`。侧边栏为真实原生 360×645 CSS 像素、DPR 2；不是通过模拟视口宣称 Chrome 支持更窄宽度。无个人账号、日常浏览记录或用户 Cookie。

扩展 UI 与第三方网页均为真实截图，没有 AI 重绘、替换按钮、伪造 AI 回复、伪造评价或服务背书。说明页通过 HTML/CSS 添加外部标题、文字、品牌与框架。第 2 张将主标签和侧边栏两次实拍组合展示，并明确标注；第 3 张对真实导航栏作局部放大。小宣传图中的窗口是概念图形，不是额外产品功能。

ChatGPT 截图为未登录首页；没有提交对话。Google 搜索使用公开关键词“番茄工作法”；维基百科为同名公开词条。第三方品牌只用于说明所访问的网站；SideBrowser 与这些网站无隶属关系。页面可用性记录只代表拍摄时显示成功，不证明所有登录、对话或网站始终可用。

## 重新生成

```sh
# 需要独立 Chrome for Testing，安装方式同 docs/development.md
npm run store:capture

# 使用已保存的真实截图重排版，不再访问网站
npm run store:render

# 生成扩展 ZIP；校验图片尺寸、哈希、描述长度和产物边界；输出资料总包
npm run store:package
```

可通过 `CHROME_PATH` 指定已安装的 Chrome for Testing 路径。截图只操作新建的临时配置，退出时删除该配置。每张截图完成后写入来源记录；内容加载超时会报错，不用空白页覆盖该站点已有素材。编辑 `design.html` 可调整说明文字和排版；重新渲染后需逐张检查 100% 和缩小显示。网站页面变更可能需要更新采集等待条件。

图片尺寸按 [Chrome 官方图片规范](https://developer.chrome.com/docs/webstore/images) 准备。现成商店说明图为简体中文；官网素材生成器另外提供 ChatGPT、维基百科、Google 搜索三个场景的中英文／浅深色说明图。公开隐私政策位于 https://yuzhouu.github.io/side-browser/privacy/ ，由 Pages 工作流发布。提交前确认部署成功，并完成开发者账号信息和审核字段，详见 `submission.md`。

主页面对照更新：AI 主宣传图和横幅展示主页面与 ChatGPT 侧窗；百科／搜索情景也在官网生成器中并排展示。最近记录、快速打开和外观图保留局部细节说明。`source/main-reference.png` 为主页面番茄工作法文章，`source/main-research.png` 为正常滚动到正文的时间管理文章，其来源、尺寸与哈希见相邻 JSON。
