# 侧窗 · SideBrowser 隐私政策 / Privacy Policy

更新日期 / Updated: 2026-09-16 · 适用版本 / Version: 1.0.0

## 简体中文

侧窗 · SideBrowser 由 yuzhou 开发，在 Chrome 原生侧边栏中打开用户选择的网页。侧窗本身没有账号系统，不运营收集浏览记录的服务器，不含遥测或广告追踪。

### 扩展处理的数据与用途

- 用户主动选择打开当前网页时，扩展读取当前标签的网址和标题，用于在侧边栏打开该网页。右键链接、地址输入和搜索同样仅用于用户发起的导航。
- 扩展在本机保存最近主动打开的最多 10 个网址及对应标题，供“最近打开”列表使用；读取 Chrome 提供的网站图标用于展示列表。
- 扩展在会话存储中保存各窗口的网址、前进／后退历史；用户主动绑定后，还保存对应标签 ID 与侧窗网址、历史的关系，解除绑定、关闭标签或重启浏览器后清除该绑定；在本地存储中保存最后的导航状态，供网页恢复使用。网址可能包含用户输入的查询参数。
- 手机／电脑模式、外观偏好保存在本机。扩展读取侧边网页的网址、标题和视口元数据，以同步导航、更新最近标题和适配显示。它不提取主标签的正文、表单内容、密码或 AI 对话内容，也不会自动把主页面内容发送给 AI。
- 对侧边栏内的请求，扩展调整嵌入兼容响应头；手机模式还会调整设备身份请求头。它不读取或记录响应体，不通过 Cookie API 读取 Cookie。

以上扩展状态使用 Chrome 的本地／会话存储，不使用 Chrome 同步存储，不上传给开发者，不出售，也不用于广告、信用评估或与侧边浏览无关的用途。开发者不通过扩展远程查看这些记录。

### 访问网站与第三方

用户打开的网站直接接收浏览器发出的请求，包括网址、IP 地址、浏览器请求头及由浏览器按其规则附带的登录信息。用户在这些网站输入或提交的内容由相应网站处理，适用该网站自己的隐私政策。AI 服务由第三方网站提供，侧窗不提供内置模型或 AI 账号，也不会替用户自动提交对话。

地址栏中的关键词搜索会向 Google 搜索发送关键词；该搜索网址也可能进入扩展的本地记录。通过帮助页打开 GitHub 或主动提交反馈时，GitHub 及收到反馈的开发者会获得用户主动提供的内容；请勿在公开反馈中包含密码、私人对话或带令牌的网址。侧窗不会自动附加诊断、浏览记录或页面内容。

网站数据由 Chrome 与网站管理，与扩展本地记录分开。HTTPS 网页使用网站提供的加密连接；用户主动打开的 HTTP 网页仍受其自身连接安全性限制，扩展不提供代理或额外加密。

### 保存与删除

最近列表支持单条删除或全部清空；清理最近列表不会删除当前网页、导航历史、网页恢复状态或网站 Cookie。将网页绑定到标签页时，该网页和历史移入绑定，共享网页及其恢复状态清空；最近列表保留。“关闭当前网页”清空当前显示的侧窗网页和导航历史，但保留最近列表和其他侧窗页面。偏好与恢复信息在本地保留，直到被后续操作覆盖或删除；会话存储由 Chrome 管理。卸载扩展会移除扩展存储，网站 Cookie 和其他网站数据需在 Chrome 中单独清理。侧窗没有开发者服务器上的浏览记录副本。

### 官网与宣传素材

官网托管于 GitHub Pages。访问官网时，GitHub 会接收常规网络请求信息；详情见 [GitHub 隐私声明](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)。官网不接入分析统计或广告追踪。网站仅在浏览器本地保存外观选择；语言由所访问的中英文页面决定。宣传图在浏览器本地生成，不会上传你的文件或浏览记录。清除该网站的浏览器数据可移除外观偏好。

### 有限用途与联系

侧窗对用户数据的使用遵守 Chrome Web Store User Data Policy，包括 Limited Use 要求；仅用于上述用户可见功能。政策随功能变化更新，更新日期列于页首。隐私问题可通过 [项目反馈页面](https://github.com/yuzhouu/side-browser/issues) 联系 yuzhou。

## English

SideBrowser is developed by yuzhou and opens user-selected websites in Chrome's native side panel. It has no account system, browsing-history server, telemetry, or advertising trackers.

### Data handled and purpose

When you explicitly open the current page, the extension reads its URL and title to navigate the sidebar. Context-menu actions, entered URLs, and search terms are used for navigation you request. Up to 10 recently opened URLs and their titles are stored locally for quick reopening; site icons are obtained through Chrome's favicon interface.

Per-window URLs and back/forward history are kept in session storage. When you explicitly bind a side page to a tab, its tab ID is associated with its sidebar URL and history in session storage; unbinding, closing that tab, or restarting the browser clears that binding. The last navigation state is kept locally for restoration. URLs may contain query parameters you enter. Display and appearance preferences are also stored locally. The extension reads the sidebar page's URL, title, and viewport metadata for navigation, recent titles, and layout. It does not extract main-tab body text, form contents, passwords, or AI conversations, and does not automatically send main-page contents to AI.

For sidebar requests, the extension adjusts embedding-related response headers and, in mobile mode, device-identity request headers. It does not read or log response bodies or read cookies through the Cookies API.

Extension state uses Chrome local/session storage, not sync storage. It is not uploaded to the developer, sold, used for advertising or credit decisions, or used for purposes unrelated to sidebar browsing. The developer cannot remotely inspect these records through the extension.

### Websites and third parties

Websites you open receive normal browser requests, including URLs, IP addresses, headers, and authentication information that Chrome permits. Content you submit on those sites is handled by those sites under their own privacy policies. AI is provided by the selected website; SideBrowser includes no AI model or AI account and does not automatically submit conversations.

Keyword searches in the address bar are sent to Google Search. The search URL may also be stored in the extension's local records. Opening GitHub or submitting feedback exposes the information you choose to share to GitHub and, for feedback, the developer. Do not include passwords, private conversations, or token-bearing URLs in public issues. SideBrowser does not automatically attach diagnostics, browsing history, or page content.

Website storage is managed separately by Chrome and the websites. HTTPS sites use their own encrypted connections. User-selected HTTP sites retain the limitations of HTTP; the extension does not provide a proxy or additional encryption.

### Retention and deletion

You can remove individual recent entries or clear the list. This does not clear the current page, navigation history, restoration state, or website cookies. Binding transfers the page and its history to that tab and clears the shared page and its restoration state, while retaining recents. Closing the current page clears the displayed sidebar page and its history while retaining recents and other side pages. Local preferences and restoration state remain until overwritten or removed; Chrome manages session storage. Uninstalling removes extension storage. Website cookies and other website data must be cleared separately in Chrome. There is no developer-hosted copy of browsing records.

### Website and media assets

The website is hosted on GitHub Pages. GitHub receives normal network request information when you visit; see the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). The website has no analytics or advertising trackers. It stores only your appearance preference in browser local storage; language follows the English or Chinese page you visit. Promotional images are generated locally in your browser, without uploading your files or browsing records. Clear this website’s browser data to remove the appearance preference.

### Limited Use and contact

SideBrowser's use of user data complies with the Chrome Web Store User Data Policy, including Limited Use requirements, and is restricted to the user-facing features described above. Changes are reflected in this policy and its update date. Contact yuzhou through [the project issue tracker](https://github.com/yuzhouu/side-browser/issues) for privacy questions.
