(() => {
  const script = document.currentScript;
  if (script.dataset.autoLanguage !== 'true') return;

  const supported = ['en', 'zh', 'ja'];
  let locale;
  try {
    const saved = localStorage.getItem('sidebrowser-site-language');
    if (supported.includes(saved)) locale = saved;
  } catch {}
  if (!locale) {
    locale =
      (navigator.languages?.length ? navigator.languages : [navigator.language])
        .map(language => language?.toLowerCase().split('-')[0])
        .find(language => supported.includes(language)) || 'en';
  }
  // The unprefixed page is already English and works without JavaScript.
  if (locale === 'en') return;
  location.replace(
    `${script.dataset.base}${locale}/${script.dataset.page}${location.search}${location.hash}`
  );
})();
