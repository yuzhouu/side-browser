import type { Mode, SitePreference, SitePreferences } from './types.js';

export const SITE_PREFERENCES_KEY = 'pocket-site-preferences-v1';

// Exact hostname, shared across schemes/ports but not across subdomains.
export function siteHostname(value: unknown): string {
  try {
    const url = new URL(String(value));
    // Never allow URL-filter / match-pattern metacharacters into registrations.
    return /^https?:$/.test(url.protocol) && /^(?:[a-z0-9._-]+|\[[a-f0-9:]+\])$/i.test(url.hostname)
      ? url.hostname
      : '';
  } catch {
    return '';
  }
}

export function restoreSitePreferences(value: unknown): SitePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([host, entry]) => {
      const preference = entry as Partial<SitePreference> | null;
      if (
        !host ||
        siteHostname(`https://${host}/`) !== host ||
        !preference ||
        !['mobile', 'desktop'].includes(preference.mode || '') ||
        typeof preference.requestMobile !== 'boolean'
      )
        return [];
      return [
        [
          host,
          {
            mode: preference.mode as Mode,
            requestMobile: preference.mode === 'mobile' && preference.requestMobile
          }
        ]
      ];
    })
  );
}

export function sitePreference(
  url: string,
  defaultMode: Mode,
  preferences: SitePreferences
): SitePreference {
  const host = siteHostname(url);
  return Object.hasOwn(preferences, host)
    ? preferences[host]
    : { mode: defaultMode, requestMobile: false };
}

export function mobileHosts(preferences: SitePreferences): string[] {
  return Object.keys(preferences)
    .filter(host => preferences[host].requestMobile)
    .sort();
}
