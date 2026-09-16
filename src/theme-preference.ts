import type { Theme } from './types.js';
export const THEME_KEY = 'pocket-theme-v1';

export function validTheme(value: unknown): Theme {
  return value === 'light' || value === 'dark' ? value : 'system';
}
