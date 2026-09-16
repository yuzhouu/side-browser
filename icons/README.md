# 侧窗 · SideBrowser 图标

`sidebrowser.svg` 是可编辑的矢量源文件，采用已选定的蓝黄眨眼笑脸方案。左侧大块为蓝色（`#2E9EFA`），右侧小块为黄色（`#F4C94D`），深蓝色笑脸（`#173653`）横跨两块：左眼睁开，右眼为闭眼弧线。嘴巴是一条完整的微笑曲线，与色块一起被中间的透明 gap 裁开。背景透明，没有底板、阴影、嵌入位图或外部资源。已选定的参考图保存在 `output/imagegen/blue-yellow-wink/preview.png`，其中白色仅用于展示预览。

1024 × 1024 画布中，图形外轮廓为 992 × 992 的正方形，四周留 16 单位边距，约占画布宽高的 97%。gap 为 40 单位，左／右宽度按黄金比例 `(1 + sqrt(5)) / 2` 分配剩余宽度，约为 `1.618034 : 1`。整体外侧圆角半径为 208，分割处保持直边；同一裁剪形状保证笑脸不会跨过 gap。各尺寸统一由此 SVG 导出。

## 文件

- `sidebrowser.svg`：所有尺寸共用的矢量源，`viewBox="0 0 1024 1024"`。
- `public/icons/16.png`、`public/icons/32.png`、`public/icons/48.png`、`public/icons/128.png`：扩展工具栏和扩展管理页使用的尺寸，`public/manifest.json` 已引用这些路径。
- `256.png`、`512.png`、`1024.png`：较大尺寸的 PNG，色块不透明，外围与 gap 透明。

## 重新导出

需要 Node.js 和 librsvg 提供的 `rsvg-convert`，无需安装 npm 依赖。在项目根目录运行：

```sh
npm run icons:generate
```

脚本直接将同一份 SVG 渲染为各尺寸 PNG，不启动浏览器。macOS 可通过 `brew install librsvg` 安装导出工具；如工具不在 PATH 中，可指定可执行文件：

```sh
RSVG_CONVERT="/path/to/rsvg-convert" npm run icons:generate
```

运行 `npm run build` 后，在 Chrome 扩展管理页重新加载 `dist/` 即可使用新图标；`npm run package` 生成新安装包。
