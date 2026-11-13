# SideBrowser — 日本語ストア素材

既存のデザインに合わせた日本語版です。01〜05 を順番にストアのスクリーンショット欄へ、小型画像と横長画像をそれぞれのプロモーション画像欄へアップロードできます。

| ファイル | サイズ | 内容 |
| --- | --- | --- |
| `01-ai-beside-you.png` | 1280 × 800 | 作業の隣で ChatGPT を開く |
| `02-research-in-context.png` | 1280 × 800 | 記事と参考資料を並べる |
| `03-open-in-one-step.png` | 1280 × 800 | 現在のページをすぐ開く |
| `04-recent-pages.png` | 1280 × 800 | お気に入りと最近開いたページ |
| `05-make-it-yours.png` | 1280 × 800 | レイアウト、外観、タブとの紐付け |
| `promo-small-440x280.png` | 440 × 280 | 小型プロモーション画像 |
| `promo-marquee-1400x560.png` | 1400 × 560 | 横長プロモーション画像 |
| `store-icon-128.png` | 128 × 128 | 共通ストアアイコン |

文案は [listing.md](listing.md)、プレビューは [../index.html#ja](../index.html#ja)、編集用レイアウトは [../design.html?lang=ja](../design.html?lang=ja) を参照してください。

日本語の独立した Chrome for Testing プロファイルで拡張機能 1.3.0 を開き、実際のネイティブサイドパネルと公開ページを撮影しています。個人アカウントや普段の閲覧データは使用していません。撮影日時、ブラウザ、実測サイズ、画像ハッシュは [../assets/source/ja/capture.json](../assets/source/ja/capture.json) に記録しています。

見出しと説明は画面の外側に配置しています。01、02、横長画像はメインページとサイドバーの画面を組み合わせ、03 は実際のツールバーを拡大しています。04 のお気に入りには公開サイトのサンプルデータを使用しています。小型プロモーション画像のウィンドウは概念図です。

ChatGPT は未ログインの画面で、会話は送信していません。Wikipedia と ChatGPT は利用例であり、提携・推奨を示すものではありません。サイトのログインや埋め込み制限によって利用できない場合があります。

再生成はプロジェクトのルートから実行します。必要に応じて `CHROME_PATH` に Chrome for Testing の実行ファイルを指定してください。

```sh
STORE_LOCALE=ja npm run store:capture
STORE_LOCALE=ja npm run store:render
# 既存の拡張機能 ZIP を使い、日本語の素材 ZIP のみを生成
STORE_LOCALE=ja node scripts/store-package.mjs
```

日本語の素材 ZIP は `releases/sidebrowser-store-ja-1.3.0.zip` です。これは素材集であり、インストール用の拡張機能 ZIP ではありません。ストアへのアップロードや公開は行っていません。
