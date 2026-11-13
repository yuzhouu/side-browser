// Locales share an editable layout; copy and genuine source captures are localized.
(() => {
  const locale = new URLSearchParams(location.search).get('lang') || 'zh-CN';
  if (!['en', 'ja'].includes(locale)) return;

  document.documentElement.lang = locale;
  document.title = locale === 'ja' ? 'SideBrowser · ストア掲載画像' : 'SideBrowser · Store artwork';
  const englishCopy = {
    '01-ai-beside-you': {
      h1: 'Your websites. <em>Right beside you.</em>',
      '.context-description':
        'Open your favorite sites by URL. Here, ChatGPT sits beside your work.',
      '.context-labels span': ['① Main page · Wikipedia', '② Sidebar · ChatGPT'],
      '.context-point strong': [
        'Sites <em>you choose</em>',
        'Work <em>side by side</em>',
        'Switch tabs. <em>Keep going.</em>'
      ],
      '.context-point p': [
        'Enter a URL. Open a familiar website.',
        'Keep reading while you ask a question.',
        'Your shared sidebar stays open.'
      ],
      '.foot > span':
        'Actual screenshots combined · Sites shown are examples. Login and embedding restrictions may apply.'
    },
    '02-research-in-context': {
      '.eyebrow': '02 / RESEARCH IN CONTEXT',
      h2: 'Keep your context.',
      '.lead': 'Read an article with a reference page beside it.',
      '.labelbar span': ['Main page · Time management', 'Sidebar · Wikipedia'],
      '.notes strong': ['A URL or a question', 'Both pages in view'],
      '.notes .step p': [
        'Enter a website address<br>or search with keywords.',
        'Keep your source and<br>reference side by side.'
      ],
      '.foot > span':
        'Example: two Wikipedia pages · Actual main-page and sidebar screenshots combined. Compatibility varies by site.'
    },
    '03-open-in-one-step': {
      '.eyebrow': '03 / OPEN IN ONE STEP',
      h1: 'Your next page.<br>One click away.',
      '.lead': 'Start with the current page, a link,<br>or a new question.',
      '.step strong': ['Open the current page', 'Right-click to open or favorite'],
      '.step p': [
        'Use the top-left button or the welcome screen.',
        'Open page: Alt + Shift + P (Mac: ⌥ ⇧ P)'
      ],
      '.toolbar-caption': 'Actual toolbar · Open page / Back / Forward / Reload / Address / More',
      '.foot > span': 'Another page. Right beside you.'
    },
    '04-recent-pages': {
      '.eyebrow': '04 / FAVORITES & RECENTS',
      h1: 'Keep your favorites.<br>Find your way back.',
      '.lead': 'Favorite icons on the welcome screen.<br>Recent pages one click away.',
      '.ten p':
        'recently opened URLs<br><span style="font-size:18px;color:#627b8c">Stored separately from favorites</span>',
      '.step strong': ['Icons that wrap into rows', 'Hover for the title and full URL'],
      '.step p': [
        'Keep favorite websites on the welcome screen.',
        'Remove favorites individually; clear recents anytime.'
      ],
      '.foot > span': 'URLs and titles stay on your device. Clearing recents keeps your favorites.'
    },
    '05-make-it-yours': {
      '.panel-tag': ['Light · More menu', 'Dark · More menu'],
      '.eyebrow': '05 / MAKE IT YOURS',
      h2: 'A small sidebar.<br>Your way to browse.',
      '.lead': 'Adjust the view and appearance<br>from the More menu.',
      '.step strong': [
        'Mobile or desktop view',
        'Light, dark, or system',
        'Bind a page to the current tab'
      ],
      '.step p': [
        'Changing the view reloads the page.',
        'Change appearance without reloading.',
        'Come back to your tab and keep going.'
      ],
      '.foot > span':
        'Mobile view adapts page display. Each website controls how it responds to your theme.'
    },
    'promo-small-440x280': {
      '.tagline': 'Your websites. Right beside you.'
    },
    'promo-marquee-1400x560': {
      '.context-copy h1': 'Your websites.<br><em>Right beside you.</em>',
      '.context-copy p': 'Open the websites you know.<br>Two pages. One view.',
      '.context-copy > span': 'Another page. Right beside you.',
      '.context-labels span': ['① Main page · Wikipedia', '② Sidebar · ChatGPT'],
      '.foot > span':
        'Actual screenshots combined · ChatGPT and Wikipedia are examples. Choose your own websites.'
    }
  };

  const japaneseCopy = {
    '01-ai-beside-you': {
      h1: 'いつものサイトを、<em>すぐそばに。</em>',
      '.context-description': '好きなサイトを URL で開く。たとえば、作業の隣に ChatGPT を。',
      '.context-labels span': ['① メインページ · Wikipedia', '② サイドバー · ChatGPT'],
      '.context-point strong': [
        'サイトは<em>自由に</em>',
        'ふたつのページを<em>並べて</em>',
        'タブを変えても<em>そのまま</em>'
      ],
      '.context-point p': [
        'URL を入力して、いつものサイトへ。',
        '記事を読みながら、隣で質問。',
        '共有サイドバーは開いたまま。'
      ],
      '.foot > span':
        '実際の画面を組み合わせた使用例です。ログインやサイトの埋め込み制限により利用できない場合があります。'
    },
    '02-research-in-context': {
      '.eyebrow': '02 / 読みながら調べる',
      h2: '調べものは、すぐ隣で。',
      '.lead': '記事を読みながら、参考ページを並べて確認。',
      '.labelbar span': ['メインページ · 時間管理', 'サイドバー · Wikipedia'],
      '.notes strong': ['URL も検索も', '見比べながら読む'],
      '.notes .step p': [
        'サイトの URL を入力。<br>キーワードで検索も。',
        '記事と参考資料を、<br>同じ画面に。'
      ],
      '.foot > span':
        '使用例：Wikipedia の記事。メインページとサイドバーの実際の画面を組み合わせています。'
    },
    '03-open-in-one-step': {
      '.eyebrow': '03 / ワンクリックで開く',
      h1: '今見ているページを、<br>ワンクリックで隣に。',
      '.lead': '今のページも、気になるリンクも。<br>開きたいときに、すぐサイドバーへ。',
      '.step strong': ['現在のページをすぐ開く', '右クリックで開く・登録する'],
      '.step p': [
        '左上のボタンか、ホーム画面から。',
        'ショートカット：Alt + Shift + P（Mac：⌥ ⇧ P）'
      ],
      '.toolbar-caption': '実際のツールバー · ホーム、戻る・進む、アドレス、お気に入り、履歴',
      '.foot > span': 'もうひとつのページを、すぐそばに。'
    },
    '04-recent-pages': {
      '.eyebrow': '04 / お気に入りと履歴',
      h1: 'いつものページへ、<br>何度でもすぐに。',
      '.lead': 'お気に入りはホームに並べて。<br>最近開いたページにも、すぐ戻れます。',
      '.ten p':
        '件の最近開いたページ<br><span style="font-size:18px;color:#627b8c">お気に入りとは別に保存</span>',
      '.step strong': ['よく使うサイトをアイコンで', 'タイトルと URL をその場で確認'],
      '.step p': ['幅に合わせて、自動で折り返します。', 'マウスを重ねると、URL を最後まで表示。'],
      '.foot > span': 'URL とタイトルは端末内に保存。履歴を削除しても、お気に入りは残ります。'
    },
    '05-make-it-yours': {
      '.panel-tag': ['ライト · メニュー', 'ダーク · メニュー'],
      '.eyebrow': '05 / 自分に合う表示に',
      h2: '小さなサイドバーを、<br>あなたの使い方に。',
      '.lead': 'レイアウトも、外観も。<br>メニューから手軽に調整。',
      '.step strong': [
        'サイトごとにレイアウトを選ぶ',
        'ライト・ダーク・システム設定',
        '必要なタブにだけ紐付ける'
      ],
      '.step p': [
        '狭いレイアウトとウィンドウ幅を選択。',
        '外観を変えても、ページはそのまま。',
        'そのタブ専用のページとして使えます。'
      ],
      '.foot > span':
        'モバイルサイトの要求も可能です。サイト内のテーマ表示は、各サイトの対応によります。'
    },
    'promo-small-440x280': {
      '.tagline': 'いつものサイトを、すぐそばに。'
    },
    'promo-marquee-1400x560': {
      '.context-copy h1': 'いつものサイトを、<br><em>すぐそばに。</em>',
      '.context-copy p': '使い慣れたサイトを、作業の隣に。<br>ふたつのページを、ひとつの画面で。',
      '.context-copy > span': 'もうひとつのページを、すぐそばに。',
      '.context-labels span': ['① メインページ · Wikipedia', '② サイドバー · ChatGPT'],
      '.foot > span': '実際の画面を組み合わせた使用例です。開くサイトは自由に選べます。'
    }
  };
  const copy = locale === 'ja' ? japaneseCopy : englishCopy;

  for (const [name, selectors] of Object.entries(copy)) {
    const board = document.querySelector(`[data-export="${name}"]`);
    if (!board) throw new Error(`Missing artwork: ${name}`);
    for (const [selector, value] of Object.entries(selectors)) {
      const nodes = [...board.querySelectorAll(selector)];
      const translations = Array.isArray(value) ? value : [value];
      if (nodes.length !== translations.length)
        throw new Error(`Translation count mismatch: ${name} ${selector}`);
      nodes.forEach((node, index) => {
        node.innerHTML = translations[index];
      });
    }
  }
  document.querySelectorAll('.brand').forEach(brand => {
    brand.lastChild.textContent = 'SideBrowser';
  });
  document.querySelectorAll('img').forEach(image => {
    const source = image.getAttribute('src');
    if (source.startsWith('assets/source/')) {
      image.src = source.replace('assets/source/', `assets/source/${locale}/`);
      image.alt =
        locale === 'ja'
          ? 'ウェブサイトと SideBrowser の実際の画面'
          : 'Actual website and SideBrowser screenshot';
    } else if (image.alt) image.alt = 'SideBrowser';
  });
  document.querySelector('.research .main-shot img').src =
    `assets/source/${locale}/main-research.png`;
  document.querySelector('.research .side-shot img').src = `assets/source/${locale}/wiki.png`;
})();
