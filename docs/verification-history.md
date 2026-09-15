# 伴页 · SideBrowser 1.6.5 英文品牌统一（2026-09-15 当前交付）

英文品牌从 SideBrowse 改为 SideBrowser；更新 manifest、侧边栏标题、帮助页、npm 包名、README 和项目说明。英文介绍为 “A browser in your sidebar.”。版本仍为 1.6.5。

本地源码加载目录 `sidebrowse`、ZIP 内目录 `pocket-browser` 和内部通信／持久化标识保持原状。原名称的安装包与下方验证记录作为历史归档；当前安装包为 `releases/sidebrowser-1.6.5.zip`。

本次验证：21 项现有 Node 测试通过，全部 JavaScript 语法通过，所有 JS 与改名前逐字节一致。独立 Chrome for Testing 149 中 5 项检查通过：实时 manifest 与侧边栏标题、帮助页品牌显示、打开当前网页、更多菜单展开／Escape 收起及网页实例与输入保留。帮助页检查 1000 × 760 和 360 × 760；实际原生侧边栏内容区为 360 × 601，另通过 CDP 模拟 320 × 680 内容视口检查单行 36px 导航及无横向溢出。320px 是内容视口模拟，不代表拖动原生侧边栏外框至该宽度。

Browser plugin not available，使用现有 Playwright/CDP。没有页面运行异常；Chrome 对既有 iframe 的 `allow-scripts` 与 `allow-same-origin` 组合给出一条提示，对应 HTML 属性与改名前一致。已查看 `/tmp/sidebrowser-brand-help-desktop.png`、`/tmp/sidebrowser-brand-help-360.png`、`/tmp/sidebrowser-brand-320.png`。命令：`npm test`、`node /tmp/sidebrowser-brand-qa.cjs`；结果为 `/tmp/sidebrowser-brand-qa.json`。本次为名称改动，未新增对登录网站、其他浏览器或全量设备兼容性的验证。

---

# 伴页 · SideBrowse 1.6.5 名称更新（历史交付）

扩展名称、浏览器按钮提示、侧边栏标题、快捷键描述、右键菜单、帮助页和 README 已使用「伴页 · SideBrowse」品牌。保留原加载目录 `pocket-browser` 与内部标识，按原目录覆盖更新。

独立 Chrome for Testing 149 原生 side panel 中 5 项检查通过：Chrome 实际读取的新名称／提示／快捷键、帮助页标题与说明、打开当前网页、菜单和输入保留、320px 布局；无捕获运行异常。Browser plugin not available，使用已有 Playwright/CDP。已查看 `/tmp/sidebrowse-brand-320.png`。运行 `node /tmp/sidebrowse-brand-qa.cjs`，结果在 `/tmp/sidebrowse-brand-qa.json`。

全部 JS 语法检查通过；与 1.6.4 比较，除 background.js 的两处用户可见名称外，所有 JS 逐字节不变，导航、状态与视口逻辑不变，因此未重复全量功能检查。安装包 `sidebrowse-1.6.5.zip` 共 27 个文件、36953 字节；manifest 引用、版本、ZIP CRC 与源码逐字节一致性通过。

---

# 1.6.4 后退／前进顺序调整

仅交换顶部两个按钮，现为后退、前进、刷新、地址栏、打开当前网页、更多；单行高度保持 36px。独立 Chrome for Testing 149 原生 side panel 验证了按钮顺序、点击后退／前进的目标 URL，以及 320px 无溢出；4 项浏览器检查通过，无捕获运行异常。已查看 `/tmp/pocket-toolbar-v164-320.png`。Browser plugin not available，使用现有 Playwright/CDP。未重复与此位置调整无关的全量检查。

命令：`node /tmp/pocket-toolbar-v164-qa.cjs`。安装包 `pocket-browser-1.6.4.zip` 共 27 个文件、36956 字节；版本一致、ZIP CRC 和源码逐字节比对通过。

---

# 1.6.3 指定导航布局验证

- 顶部保持 36px 高，顺序为前进、后退、刷新、地址栏、打开当前网页、更多。在 360px 面板中地址输入由约 226px 缩至约 151px。
- 更多菜单仅包含「在新标签页打开当前网页」和「切换为 PC／手机模式」。前者打开侧边栏当前 URL，顶部「打开当前网页」读取主标签 URL，两个方向均经交互验证。
- 独立 Chrome for Testing 149 原生 side panel；宽 280、320、360、480px。Browser plugin not available，使用现有 Playwright/CDP；本地测试网页，无用户 Cookie。
- 21 项原有单元测试、12 项浏览器检查通过，捕获运行异常为 0。页面身份、非空内容、无错误界面、截图与真实交互均通过。
- 地址栏 Enter → 顶部后退／前进／刷新 → 更多中手机／PC 切换 → 顶部打开当前网页 → 更多中在新标签页打开；URL、状态和菜单收起正确。Tab／Escape、窄宽、输入和切标签保活通过。
- 已查看 `/tmp/pocket-toolbar-v163-320.png` 和 `/tmp/pocket-toolbar-v163-320-menu.png`：控件保持一行且菜单完整显示，不遮挡顶部、不改变浏览区高度。
- 命令：`npm test --prefix outputs/pocket-browser`；`node /tmp/pocket-toolbar-v163-qa.cjs`。结果：`/tmp/pocket-toolbar-v163-qa.json`。未新增对登录后 NGA 内容、其他浏览器或触摸设备的验证。
- 安装包 `pocket-browser-1.6.3.zip`：27 个文件、36956 字节；全部 JS 语法、manifest 引用、版本、ZIP CRC 与源码逐字节一致性通过。

---

# 1.6.2 紧凑导航验证

顶部由两行 85px 改成单行 36px，把 49px 高度让给浏览区。后退、刷新、地址输入和手机／电脑切换保持直接可用；前进、打开当前网页、在新标签页打开移入浮动「⋯」菜单，展开不改变 iframe 尺寸或重载网页。

- 环境：独立 Chrome for Testing 149 实际原生 side panel，本地 NGA 公开布局代码夹具；实际宽 360px，另检查 280／320／480px。Browser plugin not available，使用已安装 Playwright/CDP，无日常浏览器资料或用户 Cookie。
- 结果：21 项原有 Node 单元测试、12 项实际浏览器检查通过；页面运行异常为 0。没有为样式新增单元测试。
- 页面身份、非空内容、无错误界面：实际扩展侧边栏的标题、URL、地址栏、空状态与菜单均正确。
- 交互流程：菜单打开当前 URL → 地址栏 Enter 导航 → 后退 → 菜单前进 → 刷新 → 来回切换手机／电脑 → 展开及收起菜单 → 调整宽度 → 切标签 → 菜单在普通新标签打开。每步核对目标 URL、输入、文档 token、模式或菜单状态。
- 窄宽与键盘：各尺寸保持单行且不重叠、不裁切，网页得到剩余全部高度；Tab 可聚焦菜单按钮，Escape 收起菜单。
- 状态保持：打开菜单、280／320／480px 调宽、切标签和外部打开不重建侧边栏网页；输入保持。仅显式导航、刷新、模式切换按设计重载。
- 已查看截图：`/tmp/pocket-toolbar-320.png`、`/tmp/pocket-toolbar-320-menu.png`、`/tmp/pocket-toolbar-menu-empty.png`。界面与菜单比例符合本次收紧目标。
- 命令：`npm test --prefix outputs/pocket-browser`；`node /tmp/pocket-toolbar-qa.cjs`。完整浏览器记录在 `/tmp/pocket-toolbar-qa.json`。
- 范围：本次验证集中在导航界面；登录后的 NGA 内容、其他浏览器与触摸设备未新增实测。原手机视口兼容边界保持。

安装包：`pocket-browser-1.6.2.zip`，共 27 个文件，36918 字节。ZIP CRC、源码逐字节比对、全部 JS 语法、manifest 引用与版本一致性均通过。

---

以下为历史版本验证。

# 1.6.1 手机视口适配验证

- 版本：1.6.1；Chrome 145+；继续使用同窗口一个原生侧边栏。仅手机模式启用视口适配，保留原生桌面鼠标、悬停、滚轮与触摸点数。
- 环境：独立 Chrome for Testing 149 配置，实际原生 side panel；本地 HTTP 页面与 NGA 公开布局代码夹具，侧边栏宽 360／320 CSS px。Browser plugin not available，采用已安装的 Playwright/CDP；没有使用日常浏览器资料或用户 Cookie。
- 结果：21 项 Node 单元测试、19 项真实浏览器检查通过；收集的页面运行异常为 0。

| 检查 | 结果与证据 |
| --- | --- |
| NGA 布局对照 | 同一份 NGA 原始布局代码与 Chrome Mobile（no touch）对照：逻辑宽 525px、正文 19px、根字号 75px、360px 下缩放 0.685714，结果一致 |
| 桌面触摸特征 | 切换前后 maxTouchPoints = 0、pointer: coarse = false、hover: hover = true |
| 原生交互 | 对缩放后的实际坐标发送鼠标事件，点击、CSS 悬停、文本输入、滚轮、跨域链接和原生 POST 均通过 |
| 请求身份 | 扩展文档树中的脚本、fetch 使用手机 UA；普通标签页及其资源保留电脑请求头；电脑模式恢复原生身份 |
| 视口声明 | 数字宽度 525／700、动态 meta 更新、width=device-width 和无声明的 980px 布局适配通过 |
| 保持页面实例 | 切标签、关闭来源页、320px 调宽、停止真实 Worker 并重新连接、Chrome 窗口全屏后文档 token 保持，输入仍在 |
| 页面与入口 | 原生侧边栏非空，地址栏可编辑，没有辅助标签页 |
| 截图 | 已查看 /tmp/pocket-mobile-viewport-preview.png、/tmp/pocket-mobile-viewport-narrow.png，完整布局适配侧边栏且控件可见 |

命令：`npm test --prefix outputs/pocket-browser`；`node work/mobile-viewport-qa.cjs`。浏览器结果保存在 `/tmp/pocket-mobile-viewport-qa.json`，截图与该 JSON 为本机临时证据。

范围：这是扩展的视口兼容层，并非 DevTools 原生设备模拟。底层栅格化和 CSS 设备／分辨率媒体查询保留真实设备行为，未模拟捏合缩放、虚拟键盘、嵌套页面和 Worker 的完整设备环境。最终屏幕几何通过消息同步，任意网站首段脚本不保证读到精确侧边栏尺寸。NGA 测试使用公开原始布局代码，未验证用户登录后的完整页面或账号字体偏好。

安装包：`pocket-browser-1.6.1.zip`，共 27 个文件，36231 字节；ZIP CRC、每个文件与交付目录逐字节一致、manifest 引用、JS 语法与版本一致性均通过。

---

以下为历史版本验证，不代表 1.6.1 的全部行为。

# 1.6.0 原生 side panel 验证

- 版本：1.6.0；Chrome 145+；同窗口共用一个原生侧边栏，不再重建页面浮层。
- 环境：独立 Chrome for Testing 149 配置，本地 HTTP 测试页面与用户提供的 NGA URL；实际侧边栏宽 360 CSS px，额外验证 320px。Browser plugin not available，采用已安装 Playwright/CDP；原生扩展快捷键用 CUA 操作。
- 结果：15 项 Node 单元测试、22 项真实浏览器检查通过；收集的页面运行异常为 0。

| 检查 | 结果与证据 |
| --- | --- |
| 页面身份 | 真正的 chrome-extension://…/sidepanel.html 原生侧边栏，标题「小窗 · 侧边栏浏览器」 |
| 非空与错误界面 | 首屏包含地址栏、导航按钮、空状态；没有框架错误遮罩 |
| 交互与持久运行 | 切标签、关闭来源页、刷新主标签、停止并唤醒真实 Worker，iframe 的随机文档 token 不变；文本、点击状态和滚动保留；网页请求次数仍为 1 |
| 导航 | 跨域 target=_blank 链接、POST、SPA 地址更新、跳转、前进后退、显式刷新、无效协议拒绝均通过 |
| 窗口与入口 | 两个实际浏览器窗口有不同侧边栏实例和历史；内部 chrome:// 页面保持原实例；关闭面板后原生 ⌥⇧P 重新打开当前 URL；没有辅助标签页 |
| 手机与隔离 | iframe 首段脚本与请求头 UA/Client Hints 一致；电脑模式恢复原生身份；普通主页面及其 iframe 请求仍为电脑 UA |
| 全屏与窄宽 | Chrome 窗口全屏可点击且同一文档；320px 顶栏不溢出，地址栏可输入 |
| 外部页面 | NGA 指定 URL 读取 Android UA，手机分支执行；返回「未登录」，未验证登录后的帖子正文 |
| 截图 | /tmp/pocket-sidepanel-preview.png、/tmp/pocket-sidepanel-narrow.png、/tmp/pocket-sidepanel-nga.png，均已查看 |

关键流程：打开真实侧边栏 → 输入文字并滚动 → 切换标签 → 关闭来源标签 → 主标签刷新 → 比较文档 token、输入、滚动、HTTP 请求数 → 停止 Worker 并唤醒 → 再次比较。全程不重建网页。

命令：`npm test --prefix outputs/pocket-browser`；`node work/sidepanel-qa.cjs`。后者在 `NATIVE_SHORTCUT_READY` 时需要向独立 Chrome 测试窗口发送原生 ⌥⇧P；Playwright 的渲染器按键不会触发该浏览器快捷键。本次已通过 CUA 原生按键验证。

边界：手机/电脑是扩展共用偏好，各窗口 URL/历史独立。主动关闭面板、退出浏览器后恢复保存的 URL/历史，不承诺保留网页内存；HTML/视频自身全屏、完整触摸模拟及所有网站兼容性未验证。

安装包：`pocket-browser-1.6.0.zip`，共 25 个文件，31514 字节；ZIP CRC、每个文件与交付目录逐字节一致、manifest 引用、JS 语法与版本一致性均通过。

---

以下为历史版本验证，不代表 1.6.0 当前架构。

# 小窗 1.5.1 手机 UA 验证

保留 1.5.0 的页面浮层。只修复网站脚本仍读取电脑 UA 的问题，没有增加常驻标签页，也没有解决跨标签重新挂载引发的刷新。

使用隔离配置的 macOS Chrome for Testing 149、Playwright、本地受控检测网页和用户指定的 NGA URL。Browser plugin not available。18 项单元测试、11 项实际浏览器检查通过，未收集到页面运行时异常。

实际浏览器证明：网站第一段脚本读取 Android UA、Linux armv8l 和 Android／Pixel 7 Client Hints；文档请求的 UA、平台、机型和平台版本与之吻合。宿主页面与普通 iframe 的 JavaScript 身份保留；未移除的 CSP 仍能阻止无 nonce 的脚本。真实点击、输入、跨站链接、原生 POST、手机／电脑来回切换和跨标签恢复手机模式通过。

对 [用户提供的 NGA 页面](https://bbs.nga.cn/read.php?tid=47560602)，现场读取 `navigator.userAgent` 为 Android Mobile，`userAgentData.mobile` 为 true，站点自己的 mobile 判断分支实际执行，显示了它原本隐藏的“使用 APP 打开”链接。服务器返回“未登录”，因此没有验证需要登录的帖子正文布局，也未尝试登录或修改账户内容。

已查看[手机 UA 对照截图](mobile-identity-preview.png)和[NGA 实际页面截图](nga-mobile-preview.png)，确认小窗里的手机判断与宿主电脑判断不同，输入和控件可用。

UA 兼容不是完整设备模拟。fetch／XHR／资源请求、网站 Worker 和嵌套 iframe 未统一覆盖；账号保存的布局设置也可能影响页面。跨标签不重载仍不满足，按用户选择保留页面浮层，未切换为文档画中画或独立窗口。

以下为旧版历史验证；其中“不覆盖 JavaScript navigator”的说明已由 1.5.1 的上述受限兼容层取代。

---

# 小窗 1.5.0 全屏与页面浮层验证

当前默认实现是页面浮动 div + 扩展导航 iframe + 真实网站 iframe。1.4.x 独立窗口方案已撤回。Service Worker 保存全局状态，只在当前普通网页显示一个小窗；跨标签页继续 URL 和历史，并重新加载内部网页。

## 本次环境与结果

Browser plugin not available，使用本机 Playwright 与隔离配置的 macOS Chrome for Testing 149。受控网页为临时 127.0.0.1／localhost 服务；没有修改日常 Chrome 配置。检查了原生全屏视口与 360 × 740 窄视口。

17 项单元测试、16 项真实浏览器检查通过。检查覆盖默认入口不创建独立弹窗或辅助标签、调试 API 不可用、真实 DOM 点击与输入、宿主导航 UA 和 CSP 保留、网页元素全屏、原生 Chrome 窗口全屏、跨站链接、target=_blank、后退、POST 表单、跨标签单实例、关闭初始来源页、实际停止／唤醒 Worker、拖动缩放、折叠展开、窄视口、关闭后刷新及重开恢复。

| 界面检查 | 结果 |
| --- | --- |
| 页面身份 | 实际父子 Frame 关系证明小窗挂载在当前网页中，窗口 API 没有新 popup |
| 非空与控件 | 地址栏、导航、模式、标题栏和网页实际显示，无空白或框架错误遮罩 |
| 运行时错误 | 已完成测试收集到的页面运行时错误为空 |
| 全屏交互 | 原生窗口全屏与 section 元素全屏后，仍可点击真实 iframe；实例 token 与未提交中文输入不变 |
| 跨标签 | 旧页移除浮层，新页仅有一份 iframe；URL、历史保留 |
| 360px | 窗口边界和地址栏无横向溢出，内容仍可点击 |

已查看实际截图：[Chrome 窗口全屏](fullscreen-browser-preview.png)、[网页元素全屏](fullscreen-element-preview.png)、[360px 页面浮层](fullscreen-narrow-preview.png)。截图只包含网页内容区；原生全屏状态由 Chrome 窗口 API 返回值以及操作后的 iframe 点击共同验证。

## 已知范围

需要 Chrome 133+，使用 `moveBefore()` 在同一文档全屏切换时移动浮层并保持 iframe 状态。[Chrome 文档](https://developer.chrome.com/blog/movebefore-api)。跨标签重新挂载会重新加载网页，不能跨标签保留未提交输入或网页内存。

DNR 规则覆盖当前承载页的子框架文档请求，该页自身其他 iframe 文档也可能受到影响；主页面导航、脚本、图片和 fetch 不在本版规则范围内。CSP 包含 frame-ancestors 时移除该次响应的整条 CSP，其他标签页不受影响。[DNR 文档](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)。

未逐一验证第三方登录、DRM、跨域播放器全屏、闭合 Shadow DOM 全屏、Google 外网搜索、浏览器内部页面及其他桌面应用。页面浮层不能覆盖其他桌面应用，浏览器禁止注入的页面不显示。

以下为旧版历史验证，描述对应版本，不代表当前 1.5.0 的窗口或请求范围。

---

# 小窗 1.4.1 验证记录

## 1.4.1 小数坐标回归

修复 `windows.create` 收到小数 `left` 时抛出的 `expected integer, found number`。保存状态恢复、屏幕边界计算、窗口创建与折叠展开现在统一使用整数，保留多显示器的负坐标以及已有网址、模式和历史。

本次使用独立临时配置的 macOS Chrome for Testing 149 加载 1.4.1，并用真实 Service Worker 停止／唤醒重新读取人工植入的旧版小数数据，没有修改日常浏览器配置。

20 项单元测试、7 项真实浏览器回归检查通过：

| 检查 | 结果 |
| --- | --- |
| 原错误复现 | 直接向真实 Chrome 传入 `left: 220.25`，捕获到与反馈相同的整数类型错误 |
| 旧数据恢复 | 四项位置／尺寸都带小数时，重新启动 Worker 后成功创建 510 × 621 窗口；网页可点击、输入；历史、当前位置和手机模式保留 |
| 折叠展开 | 展开高度为整数 621，网页实例与未提交输入不变 |
| 全局单实例 | 重复打开仍是同一小窗，没有创建第二个 |
| 小数屏幕边界 | 超出屏幕的旧尺寸配合小数屏幕矩形成功限制为整数；从已折叠状态展开为 650 × 681 |
| 首次默认位置 | 没有旧坐标时，小数屏幕矩形同样能成功打开 430 × 681 窗口 |
| 运行时错误 | 除主动捕获的原错误复现外，没有收集到页面运行时错误 |

负坐标、无效边界和展开最小尺寸由单元测试覆盖。所有发布 JavaScript 通过语法检查，清单和 package 版本均为 1.4.1。本次未改界面，也未重跑下方 1.4.0 的完整兼容流程；以下记录保留为上一版验证证据。

## 1.4.0 独立窗口验证记录

按最新要求改为独立 Chrome 小窗口，来源页面只提供初始 URL。删除页面浮层、来源标签页切换／消息依赖和所有调试接口；请求规则仅匹配扩展独立窗口自身的内容页 ID。

## 环境

Browser plugin not available，使用本机 Playwright 和 macOS Chrome for Testing 149，在独立临时配置实际加载扩展。没有修改日常 Chrome 配置。受控网站使用 127.0.0.1 和 localhost；仅测试配置授予本地网络访问权限。

验证路径：打开独立小窗 → 在真实 iframe 输入 → 切换／刷新／挂起／关闭来源页面 → 保留同一个网页实例 → 导航和模式切换 → 停止真实 Worker → 浏览器重启 → 关闭和继续。

## 结果

14 项单元测试、20 项实际浏览器流程检查通过，所收集的运行时错误为空。

| 检查 | 结果 |
| --- | --- |
| 页面与窗口身份 | Chrome 窗口 API 确认为 popup，只有一个自身内容页；来源页面没有 iframe 注入，也没有额外配套标签页 |
| 调试接口移除 | 实際加载后的权限不含 debugger，chrome.debugger 为 undefined；发布运行代码不含调试调用。不是通过隐藏 Chrome 提示条实现 |
| 来源页面独立性 | 切换、刷新、通过 CDP 挂起并关闭来源页面后，小窗内 instanceToken 不变，未提交中文输入保留 |
| 真实网页交互 | 按钮、输入、跨主机原生链接、target=_blank 留在小窗、后退与原生 POST 通过 |
| 响应规则边界 | 小窗的禁止嵌入页面可显示；来源页面无 nonce 内联脚本仍被 CSP 阻止，来源设备标识未改变 |
| 请求 UA | 手机请求带移动标识，真实 iframe 宽度最多 390px；电脑模式移除请求头覆盖 |
| 单一窗口 | 再次打开扩展聚焦同一窗口，窗口 ID 与网页 instanceToken 保持一致 |
| Worker 与浏览器恢复 | 实际停止 Service Worker 后网页实例和输入保留；完整重启测试浏览器自动恢复小窗，URL、模式和历史保留 |
| 关闭与折叠 | 折叠／展开不重建网页；关闭小窗后，切换其他标签页不会将它复活 |
| 窄宽和界面 | 独立原生窗口缩至 360px、扩展面板 320px／360px 时无横向溢出；没有空白界面或框架错误遮罩 |

所有 JavaScript 通过语法检查。清单和 package 版本为 1.4.0。单元测试涵盖独立内容页请求作用域、移除调试／来源注入权限、共享历史与状态恢复，以及输入解析。

## 截图

已查看[独立窗口内容截图](independent-preview.png)、[窄原生窗口内容截图](independent-mobile-preview.png)与[扩展面板截图](panel-preview.png)，确认地址栏、模式、折叠按钮与网页内容可用且无控件重叠。这些是实际原生窗口的内容区截图，不包含系统窗口边框；无调试功能的证据来自实际权限／API 和发布源代码检查。

## 限制与变化

独立窗口可能被其他窗口遮挡，不保证系统画中画式置顶。手机模式仅修改网络请求 UA／移动请求标识并限制 iframe 宽度，没有 debugger 的触摸、像素比或 JavaScript navigator 模拟。

DNR 无法只移除 CSP 内的一个指令，因此遇到包含 frame-ancestors 的 CSP 响应，会移除该次响应的 CSP 响应头；这个处理仅限独立小窗内容页。外部登录、Cookie、DRM、部分网站的框架检测和所有平台没有逐项验证。Google 外网搜索结果、实体快捷键与右键菜单未在本次完整自动化验收。完整更新方式和兼容范围见 [README](pocket-browser/README.md)。
