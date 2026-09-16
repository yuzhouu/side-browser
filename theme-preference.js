export const THEME_KEY = 'pocket-theme-v1';

export function validTheme(value) {
  return ['light', 'dark'].includes(value) ? value : 'system';
}
