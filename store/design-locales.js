// Both languages use the same editable layout; only copy and real source captures change.
(() => {
  const locale = new URLSearchParams(location.search).get('lang') || 'zh-CN';
  if (locale !== 'en') return;

  document.documentElement.lang = 'en';
  document.title = 'SideBrowser · Store artwork';
  const copy = {
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
      '.step strong': ['Open the current page', 'Right-click a link'],
      '.step p': [
        'Use the top-left button or the welcome screen.',
        'Shortcut: Alt + Shift + P (Mac: ⌥ ⇧ P)'
      ],
      '.toolbar-caption': 'Actual toolbar · Open page / Back / Forward / Reload / Address / More',
      '.foot > span': 'Another page. Right beside you.'
    },
    '04-recent-pages': {
      '.eyebrow': '04 / RECENT PAGES',
      h1: 'Back to a page.<br>Back to your flow.',
      '.lead': 'The clock in the address bar keeps<br>recently opened pages close at hand.',
      '.ten p':
        'recently opened URLs<br><span style="font-size:18px;color:#627b8c">Reopen a page to move it to the top</span>',
      '.step strong': ['Recognize it. Reopen it.', 'Remove one, or clear the list'],
      '.step p': [
        'Find pages by their site icon and title.',
        'Your current page and navigation history stay.'
      ],
      '.foot > span':
        'URLs and titles stay on your device. Clearing recent pages leaves the current page and navigation history intact.'
    },
    '05-make-it-yours': {
      '.panel-tag': ['Light · More menu', 'Dark · More menu'],
      '.eyebrow': '05 / MAKE IT YOURS',
      h2: 'A small sidebar.<br>Your way to browse.',
      '.lead': 'Adjust the view and appearance<br>from the More menu.',
      '.step strong': [
        'Mobile or desktop view',
        'Light, dark, or system',
        'Need more room? Open a tab.'
      ],
      '.step p': [
        'Changing the view reloads the page.',
        'Change appearance without reloading.',
        'Or close the page to return to welcome.'
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
      image.src = source.replace('assets/source/', 'assets/source/en/');
      image.alt = 'Actual website and SideBrowser screenshot';
    } else if (image.alt) image.alt = 'SideBrowser';
  });
  document.querySelector('.research .main-shot img').src = 'assets/source/en/main-research.png';
  document.querySelector('.research .side-shot img').src = 'assets/source/en/wiki.png';
})();
