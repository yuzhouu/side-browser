# 侧窗 · SideBrowser — 简体中文商店资料

本文件夹包含中文商店文案及全套成品图片。英文资料位于 [../en/](../en/)，两种语言的预览入口为 [../index.html](../index.html)。

- [listing.md](listing.md)：名称、简短介绍、详细介绍等商店字段。
- `01-…05-….png`：5 张 1280×800 功能说明图，按编号顺序上传。
- `promo-small-440x280.png`：440×280 小宣传图。
- `promo-marquee-1400x560.png`：1400×560 可选横幅。
- `store-icon-128.png`：128×128 商店图标；英文文件夹中也包含相同图标。

本套独立 ZIP 为 `../../releases/sidebrowser-store-zh-CN-1.0.0.zip`。扩展安装包为 `../../releases/sidebrowser-1.0.0.zip`，资料包本身不可安装。

真实原图及来源记录在 `../assets/source/`；共用排版源稿为 `../design.html`，图片尺寸和 SHA-256 清单为 `../manifest.json`。在项目根目录运行 `npm run store:render` 会同时导出两种语言到各自文件夹，运行 `npm run store:package` 会校验并生成两套独立 ZIP 与完整准备包。

提交字段与权限说明见 [../submission.md](../submission.md)，中英文隐私政策见 [../../docs/privacy-policy.md](../../docs/privacy-policy.md)。

本轮覆盖收藏图标换行与完整网址提示、最近记录、网页／扩展图标右键入口、标签绑定、关闭网页、显示模式和外观。第 4 张展示收藏与最近记录，第 5 张使用最新菜单并说明绑定。
