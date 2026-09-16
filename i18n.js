export const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);

export function errorMessage(error) {
  if (error?.code) return t(error.code) || t('errorUnexpected');
  return error?.message || t('errorUnexpected');
}

export function localizeDocument(doc = document) {
  // Use the translated content's language, including when Chrome falls back to English.
  doc.documentElement.lang = t('documentLanguage');
  doc.documentElement.dir = t('documentDirection');
  for (const element of doc.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const attribute of ['title', 'placeholder', 'aria-label']) {
    const marker = `data-i18n-${attribute}`;
    for (const element of doc.querySelectorAll(`[${marker}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(marker)));
    }
  }
}
