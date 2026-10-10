# 侧窗 · SideBrowser 隐私政策 / Privacy Policy / プライバシーポリシー

更新日期 / Updated / 更新日: 2026-10-10 · 适用版本 / Version: 1.2.0

## 简体中文

侧窗 · SideBrowser 由 yuzhou 开发，在 Chrome 或 Microsoft Edge 的原生侧边栏中打开用户选择的网页。侧窗本身没有账号系统，不运营收集浏览记录的服务器，不含遥测或广告追踪。

### 扩展处理的数据与用途

- 用户主动选择打开当前网页时，扩展读取当前标签的网址和标题，用于在侧边栏打开该网页。右键链接、地址输入和搜索用于用户发起的导航；右键收藏读取目标网页的网址和可用标题用于保存收藏，不会自动打开网页。
- 扩展在本机保存最近主动打开的最多 10 个网址及对应标题，供“最近打开”列表使用；读取浏览器提供的网站图标用于展示列表。
- 用户通过侧窗菜单、网页右键或扩展图标右键主动收藏的网页网址和标题独立保存在本机，供空白页下方快捷打开；收藏列表同样使用浏览器提供的网站图标，收藏操作不读写浏览器原生书签。
- 扩展在会话存储中保存各窗口的网址、前进／后退历史；用户主动绑定后，还保存对应标签 ID 与侧窗网址、历史的关系，解除绑定、关闭标签或重启浏览器后清除该绑定；在本地存储中保存最后的导航状态，供网页恢复使用。网址可能包含用户输入的查询参数。
- 默认布局、按完整域名保存的布局和请求手机版选择、外观及搜索引擎偏好保存在本机。网站偏好可在设置页逐项恢复默认。扩展读取侧边网页的网址、标题和视口元数据，以同步导航、更新收藏和最近记录的标题和适配显示。它不提取主标签的正文、表单内容、密码或 AI 对话内容，也不会自动把主页面内容发送给 AI。
- 对侧边栏内的请求，扩展调整嵌入兼容响应头。网站自身 service worker 代为获取的网页，浏览器无法区分是否来自侧边栏，扩展仅移除其 `X-Frame-Options` 响应头。仅对用户主动开启「请求手机版」的完整域名调整设备身份请求头。它不读取或记录响应体。
- `cookies` 权限仅用于侧边栏中直接打开的 HTTPS 网页：浏览器会随该网页的请求发送其 SameSite=Lax/Strict Cookie，却不让网页脚本读取。扩展在本机读取该网站自己的非 HttpOnly Cookie，只提供给该网页，与它在普通标签页中可读取的内容一致。HttpOnly Cookie、其他网站的 Cookie 和嵌套框架不在此范围内；扩展不保存、不修改、不上传 Cookie，无痕窗口不使用此功能。

以上扩展状态使用浏览器的本地／会话存储，不使用浏览器同步存储，不上传给开发者，不出售，也不用于广告、信用评估或与侧边浏览无关的用途。开发者不通过扩展远程查看这些记录。

在侧窗地址栏输入时，联想会合并侧窗收藏、最近打开与匹配的浏览器浏览历史、书签。`history` 和 `bookmarks` 权限仅用于查询联想所需的网址和标题。输入和查询结果在本机处理，不发送给联想服务或开发者，也不复制到扩展存储。选择建议后会正常打开并加入侧窗最近记录。清空侧窗最近记录不会删除浏览器浏览历史或书签。

### 访问网站与第三方

用户打开的网站直接接收浏览器发出的请求，包括网址、IP 地址、浏览器请求头及由浏览器按其规则附带的登录信息。用户在这些网站输入或提交的内容由相应网站处理，适用该网站自己的隐私政策。AI 服务由第三方网站提供，侧窗不提供内置模型或 AI 账号，也不会替用户自动提交对话。

提交地址栏中的关键词搜索或点击搜索候选时，会向设置中所选的搜索引擎（Google、Bing、百度或 DuckDuckGo，默认 Google）发送关键词；该搜索网址也可能进入扩展的本地记录。通过帮助页打开 GitHub 或主动提交反馈时，GitHub 及收到反馈的开发者会获得用户主动提供的内容；请勿在公开反馈中包含密码、私人对话或带令牌的网址。侧窗不会自动附加诊断、浏览记录或页面内容。

网站数据由浏览器与网站管理，与扩展本地记录分开。HTTPS 网页使用网站提供的加密连接；用户主动打开的 HTTP 网页仍受其自身连接安全性限制，扩展不提供代理或额外加密。

### 保存与删除

收藏会在浏览器重启后保留，可在更多菜单或空白页收藏列表中逐条取消。清空最近记录、关闭网页及绑定／解除绑定不会删除收藏。

最近列表支持单条删除或全部清空；清理最近列表不会删除当前网页、导航历史、网页恢复状态或网站 Cookie。将网页绑定到标签页时，该网页和历史移入绑定，共享网页及其恢复状态清空；最近列表保留。“关闭当前网页”清空当前显示的侧窗网页和导航历史，但保留收藏、最近列表、标签绑定和其他侧窗页面。偏好与恢复信息在本地保留，直到被后续操作覆盖或删除；会话存储由浏览器管理。卸载扩展会移除扩展存储，网站 Cookie 和其他网站数据需在浏览器中单独清理。侧窗没有开发者服务器上的浏览记录副本。

### 官网

官网托管于 GitHub Pages。访问官网时，GitHub 会接收常规网络请求信息；详情见 [GitHub 隐私声明](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)。官网不接入分析统计或广告追踪。网站在浏览器本地保存外观和手动选择的语言。默认入口根据浏览器语言选择中文、英文或日语，不匹配时使用英文；已保存的手动选择优先，带语言前缀的链接始终显示指定语言。语言判断在本机进行，不发送给开发者。清除该网站的浏览器数据可移除这些偏好。

### 有限用途与联系

侧窗对用户数据的使用遵守 Chrome Web Store User Data Policy，包括 Limited Use 要求；仅用于上述用户可见功能。政策随功能变化更新，更新日期列于页首。隐私问题可通过 [项目反馈页面](https://github.com/yuzhouu/side-browser/issues) 联系 yuzhou。

## English

SideBrowser is developed by yuzhou and opens user-selected websites in the native side panel of Chrome or Microsoft Edge. It has no account system, browsing-history server, telemetry, or advertising trackers.

### Data handled and purpose

URLs and titles of pages you explicitly favorite from the side panel, a page context menu, or the extension icon context menu are stored separately on your device for quick access from the blank page. Favorite icons use the browser's favicon interface. The extension does not modify browser bookmarks.

When you explicitly open the current page, the extension reads its URL and title to navigate the sidebar. Open context-menu actions, entered URLs, and search terms are used for navigation you request. Favorite context-menu actions read the target page’s URL and available title to save it without automatically opening it. Up to 10 recently opened URLs and their titles are stored locally for quick reopening; site icons are obtained through the browser's favicon interface.

Per-window URLs and back/forward history are kept in session storage. When you explicitly bind a side page to a tab, its tab ID is associated with its sidebar URL and history in session storage; unbinding, closing that tab, or restarting the browser clears that binding. The last navigation state is kept locally for restoration. URLs may contain query parameters you enter. Default layout, per-hostname layout and mobile-site choices, appearance, and search engine preferences are also stored locally. Website preferences can be reset individually in Settings. The extension reads the sidebar page's URL, title, and viewport metadata for navigation, favorite and recent titles, and layout. It does not extract main-tab body text, form contents, passwords, or AI conversations, and does not automatically send main-page contents to AI.

For sidebar requests, the extension adjusts embedding-related response headers. For pages fetched by a website's own service worker, which the browser cannot attribute to the sidebar, only the X-Frame-Options header is removed. Device-identity request headers are adjusted only for exact hostnames where you explicitly enable Request mobile site. The extension does not read or log response bodies.

The cookies permission is used only for the HTTPS page opened directly in the sidebar. The browser sends that page's SameSite=Lax/Strict cookies with its requests but hides them from its scripts. The extension reads the site's own non-HttpOnly cookies on your device and provides them only to that page, matching what it can read in a normal tab. HttpOnly cookies, other sites' cookies, and nested frames are excluded. The extension does not store, modify, or upload cookies, and this does not apply in Incognito windows.

Extension state uses browser local/session storage, not sync storage. It is not uploaded to the developer, sold, used for advertising or credit decisions, or used for purposes unrelated to sidebar browsing. The developer cannot remotely inspect these records through the extension.

While you type in the sidebar address bar, suggestions combine local SideBrowser favorites and recents with matching browser browsing history and bookmarks. The history and bookmarks permissions are used only to query URLs and titles for these suggestions. Query text and results are processed on your device, are not sent to a suggestion service or the developer, and are not copied into extension storage. Selecting a suggestion opens it normally and adds it to SideBrowser recents. Clearing SideBrowser recents does not delete browser history or bookmarks.

### Websites and third parties

Websites you open receive normal browser requests, including URLs, IP addresses, headers, and authentication information that the browser permits. Content you submit on those sites is handled by those sites under their own privacy policies. AI is provided by the selected website; SideBrowser includes no AI model or AI account and does not automatically submit conversations.

Submitting an address-bar keyword search or choosing the search action sends the query to the selected search engine: Google (the default), Bing, Baidu, or DuckDuckGo. The search URL may also be stored in the extension's local records. Opening GitHub or submitting feedback exposes the information you choose to share to GitHub and, for feedback, the developer. Do not include passwords, private conversations, or token-bearing URLs in public issues. SideBrowser does not automatically attach diagnostics, browsing history, or page content.

Website storage is managed separately by the browser and the websites. HTTPS sites use their own encrypted connections. User-selected HTTP sites retain the limitations of HTTP; the extension does not provide a proxy or additional encryption.

### Retention and deletion

Favorites persist across browser restarts. You can remove them individually from the More menu or the favorites list on the blank page. Clearing recents, closing a page, binding, and unbinding do not remove favorites.

You can remove individual recent entries or clear the list. This does not clear the current page, navigation history, restoration state, or website cookies. Binding transfers the page and its history to that tab and clears the shared page and its restoration state, while retaining recents. Closing the current page clears the displayed sidebar page and its history while retaining favorites, recents, tab bindings, and other side pages. Local preferences and restoration state remain until overwritten or removed; the browser manages session storage. Uninstalling removes extension storage. Website cookies and other website data must be cleared separately in the browser. There is no developer-hosted copy of browsing records.

### Website

The website is hosted on GitHub Pages. GitHub receives normal network request information when you visit; see the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). The website has no analytics or advertising trackers. It stores your appearance preference and manually selected language in browser local storage. The default entry pages select English, Chinese, or Japanese from your browser languages, falling back to English. A saved manual choice takes priority, while links with a language prefix always display that language. Language detection happens on your device and is not sent to the developer. Clear this website’s browser data to remove these preferences.

### Limited Use and contact

SideBrowser's use of user data complies with the Chrome Web Store User Data Policy, including Limited Use requirements, and is restricted to the user-facing features described above. Changes are reflected in this policy and its update date. Contact yuzhou through [the project issue tracker](https://github.com/yuzhouu/side-browser/issues) for privacy questions.

## 日本語

SideBrowser は yuzhou が開発した拡張機能で、ユーザーが選んだウェブサイトを Chrome または Microsoft Edge の標準サイドパネルで開きます。独自のアカウント機能、閲覧履歴を収集するサーバー、テレメトリ、広告トラッカーはありません。

### 取り扱うデータと利用目的

サイドパネル、ページの右クリックメニュー、拡張機能アイコンの右クリックメニューから登録したお気に入りの URL とタイトルは、スタート画面からすぐに開けるよう、端末内に独立して保存されます。アイコンの表示にはブラウザのファビコン機能を使います。お気に入りの登録は、ブラウザ標準のブックマークを変更しません。

現在のページを開く操作をしたとき、拡張機能はその URL とタイトルを読み取り、サイドバーで開きます。右クリックメニューからの移動、入力した URL、検索語句は、ユーザーが指示した移動に使います。右クリックメニューからお気に入りに登録するときは、対象ページの URL と取得できるタイトルを読み取り、ページを自動で開くことなく保存します。自分で開いた直近 10 件までの URL とタイトルを端末内に保存し、すぐに開き直せるようにします。サイトのアイコンはブラウザのファビコン機能で取得します。

ウィンドウごとの URL と戻る・進む履歴は、セッションストレージに保存します。サイドページをタブに紐付けた場合は、そのタブ ID とサイドバーの URL・履歴の対応関係も保存します。紐付けの解除、対象タブの終了、ブラウザの再起動で、その紐付けは削除されます。ページを復元するため、最後の移動状態をローカルに保存します。URL には入力したクエリパラメータが含まれる場合があります。既定のレイアウト、ホスト名ごとのレイアウトとモバイルサイトの選択、外観、検索エンジンの設定も端末内に保存します。サイト別設定は設定画面から個別に削除できます。拡張機能はサイドページの URL、タイトル、ビューポートのメタデータを読み取り、移動の同期、お気に入りや最近の履歴のタイトル更新、表示調整に使います。メインタブの本文、フォームの内容、パスワード、AI との会話内容は抽出せず、メインページの内容を AI に自動送信することもありません。

サイドバー内のリクエストについて、埋め込みに関するレスポンスヘッダーを調整します。サイト自身の Service Worker が取得したページは、ブラウザーがサイドバーからのリクエストと区別できないため、X-Frame-Options ヘッダーのみを削除します。「モバイルサイトを要求」を明示的に有効にした完全なホスト名についてのみ、端末情報を示すリクエストヘッダーも調整します。レスポンス本文の読み取りや記録は行いません。

cookies 権限は、サイドバーで直接開いた HTTPS ページにのみ使います。ブラウザーはそのページのリクエストに SameSite=Lax/Strict の Cookie を送信しますが、ページのスクリプトからは読み取れません。拡張機能はそのサイト自身の HttpOnly ではない Cookie を端末内で読み取り、そのページにのみ渡します。通常のタブでそのページが読み取れる範囲と同じです。HttpOnly Cookie、他のサイトの Cookie、入れ子のフレームは対象外です。Cookie の保存、変更、送信は行わず、シークレットウィンドウでは使用しません。

拡張機能の状態はブラウザのローカルストレージとセッションストレージを使って保存し、同期ストレージは使いません。開発者へのアップロード、販売、広告や信用評価への利用、サイドバーでの閲覧と関係のない利用は行いません。開発者が拡張機能を通じてこれらの記録を遠隔から閲覧することはできません。

サイドバーのアドレスバーに入力すると、SideBrowser のお気に入りと最近の履歴に加え、該当するブラウザの閲覧履歴とブックマークを候補として表示します。history と bookmarks の権限は、この候補に必要な URL とタイトルの検索にのみ使います。入力内容と検索結果は端末内で処理し、候補を提供する外部サービスや開発者には送信せず、拡張機能のストレージにもコピーしません。候補を選ぶと通常どおりページを開き、SideBrowser の最近の履歴に追加します。SideBrowser の最近の履歴を消去しても、ブラウザの閲覧履歴やブックマークは削除されません。

### アクセスするサイトと第三者

開いたウェブサイトには、URL、IP アドレス、ヘッダー、ブラウザの規則に従って付加される認証情報など、通常のブラウザリクエストが送られます。各サイトで入力・送信した内容は、そのサイトが独自のプライバシーポリシーに従って取り扱います。AI は選択したサイトが提供します。SideBrowser に AI モデルや AI アカウントは内蔵されておらず、会話を自動送信することもありません。

アドレスバーでキーワード検索を実行するか、検索候補を選ぶと、設定で選択した検索エンジンに検索語句を送信します。選択肢は Google（初期設定）、Bing、Baidu、DuckDuckGo です。検索 URL が拡張機能のローカル記録に保存される場合もあります。GitHub を開いたりフィードバックを送信したりすると、自分で提供した情報が GitHub に、フィードバックの場合は開発者にも届きます。公開のフィードバックにパスワード、私的な会話、トークンを含む URL を記載しないでください。SideBrowser が診断情報、閲覧履歴、ページの内容を自動で添付することはありません。

ウェブサイトのデータはブラウザと各サイトが管理し、拡張機能のローカル記録とは別に扱います。HTTPS のサイトでは、そのサイトの暗号化された接続を使います。ユーザーが開いた HTTP のサイトには HTTP 自体の接続上の制約があり、拡張機能はプロキシや追加の暗号化を提供しません。

### 保存期間と削除

お気に入りはブラウザを再起動しても残ります。その他メニューやスタート画面のお気に入り一覧から、1 件ずつ削除できます。最近の履歴の消去、ページを閉じる操作、タブへの紐付けや解除では、お気に入りは削除されません。

最近の履歴は 1 件ずつ削除するか、一括で消去できます。消去しても、現在のページ、戻る・進む履歴、復元状態、サイトの Cookie は削除されません。タブに紐付けると、ページと履歴がそのタブに移り、共有ページとその復元状態は消去されますが、最近の履歴は残ります。現在のページを閉じると、表示中のサイドページとその移動履歴が消去されます。お気に入り、最近の履歴、タブとの紐付け、ほかのサイドページは残ります。ローカルの設定と復元情報は、上書きまたは削除されるまで保存されます。セッションストレージはブラウザが管理します。拡張機能をアンインストールすると、拡張機能のストレージは削除されます。サイトの Cookie やその他のサイトデータは、ブラウザから別途削除する必要があります。開発者のサーバーに閲覧記録のコピーはありません。

### 公式サイト

公式サイトは GitHub Pages で公開しています。アクセス時には GitHub が通常のネットワークリクエスト情報を受け取ります。詳しくは [GitHub のプライバシーステートメント](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)をご覧ください。公式サイトにはアクセス解析や広告トラッカーはありません。外観と手動で選んだ言語をブラウザのローカルストレージに保存します。言語の指定がない入口では、ブラウザの優先言語から英語、中国語、日本語を選び、対応する言語がなければ英語を表示します。保存済みの手動選択が優先され、言語付きのリンクでは常に指定の言語を表示します。言語の判定は端末内で行い、開発者には送信しません。このサイトのブラウザデータを消去すると、これらの設定も削除されます。

### Limited Use とお問い合わせ

SideBrowser によるユーザーデータの利用は、Limited Use の要件を含む Chrome Web Store User Data Policy に従い、上記のユーザー向け機能に限定されます。機能の変更に応じてポリシーを更新し、ページ冒頭に更新日を記載します。プライバシーに関するお問い合わせは、[プロジェクトのフィードバックページ](https://github.com/yuzhouu/side-browser/issues)から yuzhou までご連絡ください。
