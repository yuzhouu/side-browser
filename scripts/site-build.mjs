import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { content, scenes, mainScenes, storeUrl } from '../website/content.mjs';

const base = process.env.SITE_BASE_PATH || '/side-browser/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
  throw new Error('SITE_BASE_PATH must be an absolute directory path ending in /');
const origin = process.env.SITE_ORIGIN || 'https://yuzhouu.github.io';
const out = resolve('site-dist');
const manifest = JSON.parse(await readFile('public/manifest.json'));
const escape = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const href = (locale, page = '') =>
  `${base}${locale === 'en' ? 'en/' : ''}${page ? page + '/' : ''}`;
const asset = file => `${base}assets/${file}`;
const download = `sidebrowser-${manifest.version}.zip`;
const arrow = '<span class="arrow" aria-hidden="true">→</span>';
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/assets/downloads`, { recursive: true });
await cp('website/styles.css', `${out}/assets/styles.css`);
await cp('website/app.js', `${out}/assets/app.js`);
await cp('icons/sidebrowser.svg', `${out}/assets/sidebrowser.svg`);
await mkdir(`${out}/assets/source`, { recursive: true });
for (const scene of new Set([...scenes, ...mainScenes]))
  await cp(`store/assets/source/${scene}.png`, `${out}/assets/source/${scene}.png`);
await cp(`releases/${download}`, `${out}/assets/downloads/${download}`);
const privacy = await readFile('docs/privacy-policy.md', 'utf8');
function policy(locale) {
  const section =
    locale === 'zh'
      ? privacy.split('## 简体中文\n')[1].split('## English\n')[0]
      : privacy.split('## English\n')[1];
  if (!section) throw new Error(`Missing privacy locale ${locale}`);
  const headings = [];
  const inline = value =>
    escape(value).replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  const html = section
    .trim()
    .split(/\n\n+/)
    .map(block => {
      if (block.startsWith('### ')) {
        const text = block.slice(4);
        const id = `policy-${headings.length + 1}`;
        headings.push({ text, id });
        return `<h2 id="${id}">${escape(text)}</h2>`;
      }
      if (block.startsWith('- '))
        return `<ul>${block
          .split('\n')
          .map(line => `<li>${inline(line.replace(/^- /, ''))}</li>`)
          .join('')}</ul>`;
      return `<p>${inline(block.replaceAll('\n', ' '))}</p>`;
    })
    .join('\n');
  return { html, headings };
}
function brand(t, locale) {
  return `<a class="brand" href="${href(locale)}"><img src="${asset('sidebrowser.svg')}" alt="" width="40" height="40"><span>${t.name}</span></a>`;
}
function pageTemplate(locale, page, body, title, description) {
  const t = content[locale];
  const alternate = locale === 'zh' ? 'en' : 'zh';
  const current = name => (page === name ? ' aria-current="page"' : '');
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="color-scheme" content="light dark"><link rel="icon" href="${asset('sidebrowser.svg')}" type="image/svg+xml"><link rel="canonical" href="${origin}${href(locale, page === '404' ? '' : page)}"><link rel="alternate" hreflang="zh-CN" href="${origin}${href('zh', page === '404' ? '' : page)}"><link rel="alternate" hreflang="en" href="${origin}${href('en', page === '404' ? '' : page)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${origin}${href(locale, page === '404' ? '' : page)}"><script>try{const t=localStorage.getItem('sidebrowser-site-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme='light'}</script><link rel="stylesheet" href="${asset('styles.css')}"><script src="${asset('app.js')}" defer></script></head><body><a class="skip-link" href="#main">${t.skip}</a><header class="header container">${brand(t, locale)}<div class="header-right"><nav class="nav" aria-label="${locale === 'zh' ? '主导航' : 'Main navigation'}"><a href="${href(locale)}#features">${t.nav[0]}</a><a href="${href(locale, 'privacy')}"${current('privacy')}>${t.nav[1]}</a></nav><div class="controls"><a class="language" href="${href(alternate, page === '404' ? '' : page)}" lang="${content[alternate].lang}" hreflang="${content[alternate].lang}" aria-label="${locale === 'zh' ? 'Switch to English' : '切换到中文'}">${locale === 'zh' ? 'EN' : '中文'}</a><button class="theme" type="button" data-theme-toggle data-labels='${escape(JSON.stringify({ light: t.light, dark: t.dark }))}' aria-label="${t.dark}"><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20.8 14A9 9 0 0 1 10 3.2 9 9 0 1 0 20.8 14Z"/></svg></button></div></div></header><main id="main" class="container">${body}</main><footer class="footer container"><div>${brand(t, locale)}<p>${t.tagline}</p></div><div class="footer-right"><div class="footer-links"><a href="${href(locale, 'privacy')}">${t.privacy}</a><a href="https://github.com/yuzhouu/side-browser">${t.source}</a><a href="https://github.com/yuzhouu/side-browser/issues">${t.support}</a></div><p>© 2026 yuzhou · SideBrowser</p></div></footer><script id="page-data" type="application/json">${JSON.stringify({ base, locale, scenes, mainScenes, copy: t }).replaceAll('<', '\\u003c')}</script></body></html>`;
}
function home(locale) {
  const t = content[locale];
  return `<section class="hero"><div class="hero-copy"><h1>${t.title}</h1><p>${t.description}</p><div class="actions"><a class="button" href="${storeUrl}" target="_blank" rel="noopener noreferrer">${t.install}</a><a class="text-link" href="#features">${t.how} ${arrow}</a></div><p class="compatibility">${t.compatible}</p></div><div class="hero-stage"><div class="hero-workspace"><div class="workspace-labels"><span id="hero-main-label">${t.mainLabels[0]}</span><span id="hero-side-label">${t.sideLabels[0]}</span></div><div class="workspace-pages"><div class="main-page"><img id="hero-main-screenshot" src="${asset('source/main-reference.png')}" width="2108" height="1370" alt="${t.mainLabels[0]}" fetchpriority="high"></div><img id="hero-screenshot" src="${asset('source/ai-chatgpt.png')}" width="720" height="1290" alt="${t.screenshotAlt[0]}" fetchpriority="high"></div></div><div class="scene-buttons" role="group" aria-label="${t.sceneLabel}">${t.scenes.map((s, i) => `<button type="button" class="scene-button" data-scene="${i}" aria-pressed="${i === 0}">${s}</button>`).join('')}</div><p class="scene-caption" id="scene-caption">${t.sceneNotes[0]}</p><p class="examples-note">${t.examplesNote}</p></div></section><section class="steps" id="features" aria-label="${t.nav[0]}">${t.steps.map(([title, body], i) => `<div class="step"><span class="step-number">${i + 1}</span><h3>${title}</h3><p>${body}</p></div>`).join('')}</section><section class="details"><h2>${t.detailTitle}</h2><div class="detail-list">${t.details.map(([title, body]) => `<div><h3>${title}</h3><p>${body}</p></div>`).join('')}</div></section><section class="binding" id="tab-binding" aria-labelledby="binding-title"><div><h2 id="binding-title">${t.bindingTitle}</h2><p class="binding-intro">${t.bindingIntro}</p></div><div class="binding-content">${t.bindingModes.map(([title, body]) => `<div class="binding-mode"><h3>${title}</h3><p>${body}</p></div>`).join('')}<details class="binding-faq"><summary>${t.bindingQuestion}</summary>${t.bindingNotes.map(note => `<p>${note}</p>`).join('')}</details></div></section><section class="install" id="install"><div><h2>${t.installTitle}</h2><p class="install-note">${t.installNote}</p><div class="actions"><a class="button" href="${storeUrl}" target="_blank" rel="noopener noreferrer">${t.install}</a><a class="text-link" href="${asset('downloads/' + download)}" download>${t.download} · ${manifest.version} <span aria-hidden="true">↓</span></a></div></div><div><ol>${t.installSteps.map(item => `<li>${escape(item)}</li>`).join('')}</ol><details class="manual-install"><summary>${t.manualInstall}</summary><ol>${t.manualInstallSteps.map(item => `<li>${escape(item)}</li>`).join('')}</ol></details><p class="boundaries">${t.boundaries}</p></div></section>`;
}
const routes = [];
for (const locale of ['zh', 'en']) {
  const t = content[locale];
  const policyContent = policy(locale);
  const pages = {
    '': {
      body: home(locale),
      title: `${t.name} — ${locale === 'zh' ? '常用的网站，就在你手边' : 'Your websites, right beside you'}`,
      description: t.description
    },
    privacy: {
      body: `<header class="page-heading"><h1>${t.policyTitle}</h1><p>${t.policyIntro}</p><p class="policy-meta">${t.updated}</p></header><div class="policy-layout"><nav class="policy-toc" aria-label="${locale === 'zh' ? '政策目录' : 'Policy contents'}">${policyContent.headings.map(h => `<a href="#${h.id}">${escape(h.text)}</a>`).join('')}</nav><article class="policy-body">${policyContent.html}</article></div>`,
      title: `${t.policyTitle} · ${t.name}`,
      description: t.policyIntro
    }
  };
  for (const [page, info] of Object.entries(pages)) {
    const route = `${locale === 'en' ? 'en/' : ''}${page ? page + '/' : ''}index.html`;
    await mkdir(dirname(`${out}/${route}`), { recursive: true });
    await writeFile(
      `${out}/${route}`,
      pageTemplate(locale, page, info.body, info.title, info.description)
    );
    routes.push(origin + href(locale, page));
  }
}
await writeFile(
  `${out}/404.html`,
  pageTemplate(
    'zh',
    '404',
    `<section class="not-found"><h1>${content.zh.notFound}</h1><a class="button" href="${href('zh')}">${content.zh.home} ${arrow}</a></section>`,
    '页面未找到 · SideBrowser',
    '侧窗 · SideBrowser'
  )
);
await writeFile(`${out}/.nojekyll`, '');
await writeFile(
  `${out}/robots.txt`,
  `User-agent: *\nAllow: /\nSitemap: ${origin}${base}sitemap.xml\n`
);
await writeFile(
  `${out}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`
);
console.log(`Built 4 bilingual pages, 404 and extension download in site-dist/ (base: ${base})`);
