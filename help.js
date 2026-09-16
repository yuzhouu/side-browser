import { localizeDocument, t } from './i18n.js';

localizeDocument();
document.querySelector('.intro').textContent = t('helpIntro', chrome.runtime.getManifest().version);
