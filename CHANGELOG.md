# 更新记录 / Changelog

## 1.1.0 — 2026-09-22

- 地址栏新增联想：侧窗最近打开、侧窗收藏、Chrome 浏览历史和书签，按网址去重并显示来源，支持键盘与鼠标选择。
- 设置页新增搜索引擎选择：Google、Bing、百度和 DuckDuckGo；候选提供使用所选引擎搜索当前输入，结果在侧窗打开。
- 顶栏刷新按钮改为关闭当前网页，返回欢迎页并保留收藏、最近记录及其他网页。
- 地址栏获得焦点时自动全选文字，再次点击可定位光标编辑。
- 新增 `history`、`bookmarks` 权限，仅用于本机查询地址候选；不修改 Chrome 历史或书签，不上传查询结果。

### English

- Added address suggestions from SideBrowser recents and favorites, Chrome history, and bookmarks, with deduplication, source labels, and keyboard/mouse selection.
- Added a shared search engine preference: Google, Bing, Baidu, or DuckDuckGo. The suggestion list includes an explicit search action that opens results in the sidebar.
- Replaced the toolbar reload button with Close current page, returning to the welcome screen while retaining favorites, recents, and other pages.
- The address field selects all text when focused; a second click positions the caret for editing.
- Added `history` and `bookmarks` permissions for local suggestion queries. The extension does not modify Chrome history/bookmarks or upload query results.
