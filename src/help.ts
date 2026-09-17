import { element } from './dom.js';
import { localizeDocument } from './i18n.js';

localizeDocument();

if (!document.documentElement.lang.startsWith('zh')) {
  element<HTMLAnchorElement>('#help-website').href += 'en/';
}
