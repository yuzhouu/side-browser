export type Mode = 'mobile' | 'desktop';
export type Theme = 'system' | 'light' | 'dark';
export interface PanelState {
  url: string;
  mode: Mode;
  history: string[];
  historyIndex: number;
}
export interface PanelSnapshot extends PanelState {
  tabId: number | null;
  sourceTabId?: number;
  recentUrls: string[];
  recentTitles: Record<string, string>;
}
export interface Settings {
  mode: Mode;
  theme: Theme;
  recentCount: number;
}
export type ParsedInput =
  | { kind: 'home' }
  | { kind: 'url'; url: string }
  | { kind: 'search'; text: string };
export interface FrameMessage {
  type: 'POCKET_LOCATION' | 'POCKET_VIEWPORT' | 'POCKET_TITLE';
  url: string;
  title?: string;
  documentId: string;
  viewport?: string[];
}
export type BackgroundMessage =
  | { type: 'connected' | 'navigate' | 'activate'; state: PanelSnapshot }
  | { type: 'remove-tab'; tabId: number }
  | { type: 'recent'; urls: string[]; titles: Record<string, string> }
  | { type: 'mode'; mode: Mode };
export interface PanelRequests {
  PANEL_READY: [undefined, PanelSnapshot];
  PANEL_SAVE: [{ state: PanelState }, PanelSnapshot];
  PANEL_NAVIGATE: [{ input: string }, PanelSnapshot];
  PANEL_CLOSE: [undefined, PanelSnapshot];
  PANEL_CLEAR_RECENT: [undefined, string[]];
  PANEL_REMOVE_RECENT: [{ url: string }, string[]];
  PANEL_RECENT_TITLE: [{ url: string; pageUrl: string; title: string }, Record<string, string>];
  PANEL_MODE: [{ mode: Mode }, Mode];
  PANEL_THEME: [{ theme: Theme }, Theme];
  PANEL_BIND: [{ sourceTabId: number; bound: boolean }, PanelSnapshot];
  PANEL_CURRENT: [undefined, PanelSnapshot];
  PANEL_EXTERNAL: [undefined, boolean];
}
export interface SettingsRequests {
  SETTINGS_GET: [undefined, Settings];
  SETTINGS_MODE: [{ mode: Mode }, Settings];
  SETTINGS_THEME: [{ theme: Theme }, Settings];
  SETTINGS_CLEAR_RECENT: [undefined, Settings];
}
export type RequestArgs<T> = T extends undefined ? [] : [data: T];
export type Response<T> = { ok: true; data: T } | { ok: false; error: string; errorCode?: string };
export type PanelRequest = {
  [K in keyof PanelRequests]: {
    type: K;
    windowId: number;
    tabId?: number | null;
  } & (PanelRequests[K][0] extends undefined ? object : PanelRequests[K][0]);
}[keyof PanelRequests];
export type SettingsRequest = {
  [K in keyof SettingsRequests]: { type: K } & (SettingsRequests[K][0] extends undefined
    ? object
    : SettingsRequests[K][0]);
}[keyof SettingsRequests];
