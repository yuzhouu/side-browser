# Chrome 扩展商店提交资料

资料版本：1.0.0 · 素材更新日期：2026-09-17。此文件用于开发者后台填写，不属于公开商品介绍；后台字段名称仍需在提交时核对。

## 商店详情

| 字段 | 填写内容 |
| --- | --- |
| 分类定位 | **效率工具** |
| 新版后台细分类 | 如后台仍提供“效率工具 / Productivity”，按此选择；如仅提供新版分类，选 **Workflow & Planning（工作流程与规划）**，与边工作边查资料的用途对应。分类不写入 manifest。 |
| 默认语言 | English，与 `public/manifest.json` 的 `default_locale: en` 一致；添加简体中文商店本地化。 |
| 名称和描述 | 复制 `en/listing.md`、`zh-CN/listing.md` 对应字段和正文；简短介绍与对应语言包一致。 |
| 网站 | https://yuzhouu.github.io/side-browser/ |
| 支持网址 | https://github.com/yuzhouu/side-browser/issues |
| 隐私政策 | https://yuzhouu.github.io/side-browser/privacy/ （English: https://yuzhouu.github.io/side-browser/en/privacy/）。正文统一来自 `docs/privacy-policy.md`，由 GitHub Pages 工作流发布；提交前确认该次部署成功且未登录可访问。 |
| 联系邮箱 | 在开发者账号中填写发布者实际接收邮件的地址并完成验证；不虚构邮箱。 |

## 单一用途（可直接粘贴）

Open a user-selected website in Chrome's native side panel so the user can consult AI websites and reference material alongside their current task. Sidebar navigation, recent addresses, appearance, and display-mode controls support this single browsing purpose.

## 权限用途（对应 manifest，逐项粘贴）

### sidePanel

Displays the extension's browser interface in Chrome's native side panel. Unbound tabs in the same window share one sidebar page across tab switches. Users can explicitly bind a running side page to a tab to keep an independent page and history. This is the extension's core browsing function.

### tabs

Reads the active tab's URL and title when the user explicitly opens the current page through the toolbar, context menu, or shortcut. The extension also responds to tab activation and closure to select or release explicitly bound side pages, without recording general browsing activity. Tab lifecycle events themselves do not require this permission. Users can also open the sidebar URL in a normal tab; creating that tab itself does not require this permission. URL/title access for the explicit open-current action is the reason for the permission.

### storage

Stores window navigation state and explicitly requested tab-to-sidebar bindings, including tab IDs, sidebar URLs, and history, in session storage. Stores the last shared-page restoration state, up to 10 recently opened URLs with their titles, mobile/desktop preference, and appearance preference in local storage. This data enables page restoration and recent reopening. Binding moves the page out of the shared state; unbinding or closing the bound tab releases that independent page. Bindings end when the browser session ends. Data is not synced or uploaded to the developer.

### favicon

Uses Chrome's built-in favicon endpoint to display site icons beside recently opened URLs. No separate developer-operated icon service is contacted.

### contextMenus

Adds explicit actions to open the current page or a selected link in the side panel from the extension action, webpage, or link context menu.

### scripting

Registers and removes bundled content scripts for mobile display compatibility. Scripts verify that the page is a direct child of this extension before applying mobile identity and viewport behavior; ordinary top-level pages are not modified. All injected extension scripts are included in the package.

### declarativeNetRequestWithHostAccess

Applies session rules only to this extension's non-tab document tree using tabIds [-1] and topDomains [extension ID]. For subframe documents, removes X-Frame-Options and removes an entire Content-Security-Policy response header only when it contains frame-ancestors, because the API cannot edit an individual CSP directive. In mobile mode, changes User-Agent and Client Hints within this extension's request tree. Normal browser tabs are outside these rules. The extension does not read response bodies or modify cookie headers.

### Host permissions: http://*/* and https://*/*

Users can enter arbitrary HTTP(S) website addresses or open the current webpage; the destination is not a fixed service domain. Host access enables scoped embedding compatibility rules and bundled navigation/mobile scripts for those chosen websites. Scripts immediately return outside this extension's direct embedded page. This permission is not used to scrape ordinary tabs, harvest browsing history, or send data to the developer.

## 远程代码说明

扩展功能代码全部随 ZIP 打包，无 CDN 脚本、远程模块、动态下载扩展逻辑或远程 `eval`。后台“是否使用远程代码”按**不使用远程扩展代码**填写，并在审核说明附上下面这段，明确网站 iframe 的边界；若后台询问的是任何远程网页执行，须按其实际字段完整披露 iframe，不隐瞒远程网站脚本。

All extension functionality is implemented in bundled JavaScript. The extension displays user-selected third-party websites in a cross-origin iframe. Those websites execute their own scripts as ordinary web content, not as downloaded extension logic, and receive no extension API access. The iframe uses allow-scripts and allow-same-origin for normal site operation; it is not claimed to be an opaque-origin sandbox. Extension messaging only handles scoped navigation and viewport metadata. No remote website code is evaluated in the extension's background or extension pages.

## 隐私实践 / 数据使用

按本版本实际行为披露，不填写“完全不处理任何数据”。

| 后台数据类别 | 本版本填写依据 |
| --- | --- |
| Web history / 网页浏览记录 | 选中：本地处理用户选择的网址、最近网址、侧边导航历史及恢复状态；不上传开发者。 |
| Website content / 网站内容 | 选中：读取网页标题和视口元数据；标题用于最近列表。不是读取正文或 AI 对话。 |
| Personally identifiable information、Health、Financial and payment、Authentication information、Personal communications、Location、User activity | 扩展本身没有提取／存储这些类别的独立功能；不因第三方网站自己的表单就声称扩展收集了密码或对话。用户选择的网站正常处理其请求和输入，须与隐私政策的第三方说明一致。如后续添加采集功能须重新核对。 |

确认三项有限用途声明：不出售或向第三方转让扩展记录（政策允许的情况除外）；不用于单一用途无关的目的；不用于评估信用或贷款资格。开发者不接收这些本地记录，第三方网站直接接收用户发起的网站请求。

## 给审核人员的操作说明（可直接粘贴）

Requires Chrome 145 or later. No SideBrowser account, license key, or paid account is needed. Install, open a public HTTP(S) page, click the SideBrowser extension icon, then use Open current page or enter a URL in the sidebar address bar. Try a public documentation page to test without signing in. Navigate to another tab in the same window and verify the sidebar page remains open. Use the clock button to reopen recent addresses. The More menu includes mobile/desktop switching, appearance controls, opening in a normal tab, and closing the current page. Mode changes intentionally reload the webpage. Third-party AI sites may require their own accounts and are not required to test the extension. Embedding and login restrictions vary by website. The screenshots use actual extension UI; external site availability is not a guarantee of universal support.

## 上传与发布清单

- [x] 中英文商店名称、简短介绍、详细介绍。
- [x] 与 manifest 对应的单一用途、权限和数据处理说明。
- [x] 中英文隐私政策源文件。
- [x] 将隐私政策发布到公开 URL，并验证未登录可访问（2026-09-16，HTTP 200）。
- [ ] 发布包含 1.0.0 文案与下载包的官网更新，并核对中英文隐私页版本。
- [ ] 在开发者后台填入 https://yuzhouu.github.io/side-browser/privacy/ 。
- [ ] 在后台确认账号联系邮箱、开发者注册状态和分发地区。
- [ ] 上传 `releases/sidebrowser-1.0.0.zip`；若此版本号已在商店使用，应先提升版本再打包。
- [x] 两套本地化素材：每种语言 5 张说明图、440×280 小宣传图、1400×560 横幅；图内说明与真实界面均为对应语言。
- [ ] 默认 English 上传 `store/en/` 的英文图片；简体中文本地化上传 `store/zh-CN/` 的中文图片。两个文件夹均包含同一商店图标 `store-icon-128.png`；1400×560 横幅为可选。
- [ ] 可分别解压 `releases/sidebrowser-store-en-1.0.0.zip` 与 `releases/sidebrowser-store-zh-CN-1.0.0.zip`，从对应 `listing.md` 复制名称、简短介绍与详细介绍。
- [ ] 核对后台实际字段和预览，然后提交审核。

本地准备不代表商店已提交或审核通过。此次没有推送仓库、发布隐私页面或访问开发者账号。

## 官方参考

- [商店图片规格](https://developer.chrome.com/docs/webstore/images)：1280×800 截图、440×280 小宣传图、1400×560 可选横幅和 128×128 图标。
- [分类与商店最佳实践](https://developer.chrome.com/docs/webstore/best-practices)：原 Productivity 的新版细分映射。
- [隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)：单一用途、权限、代码和数据说明。
- [用户数据 FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)：仅在本地处理的数据也要披露。
