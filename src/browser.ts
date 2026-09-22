// Extension pages keep the host browser's UA; mobile overrides apply only to embedded websites.
export function shortcutsUrl(userAgent: string): string {
  return /\bEdg\//.test(userAgent)
    ? 'edge://extensions/shortcuts'
    : 'chrome://extensions/shortcuts';
}
