import type { mobileIdentity } from './mobile-profile.js';

(() => {
  if (
    window === window.top ||
    !Array.from(location.ancestorOrigins).at(-1)?.startsWith('chrome-extension://')
  )
    return;
  let installed = false;
  function apply(event: CustomEvent<string>) {
    if (installed) return;
    let profile: { extensionId?: string; identity?: ReturnType<typeof mobileIdentity> };
    try {
      profile = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (
      !/^[a-p]{32}$/.test(profile.extensionId || '') ||
      Array.from(location.ancestorOrigins).at(-1) !== `chrome-extension://${profile.extensionId}`
    )
      return;
    const identity = profile.identity,
      metadata = identity?.userAgentMetadata;
    if (
      typeof identity?.userAgent !== 'string' ||
      !identity ||
      !metadata?.mobile ||
      !Array.isArray(metadata.brands)
    )
      return;
    installed = true;
    document.removeEventListener('pocket-mobile-profile-ready', apply);
    const define = (key: string, value: unknown) =>
      Object.defineProperty(Navigator.prototype, key, {
        configurable: true,
        enumerable: true,
        get: () => value
      });
    define('userAgent', identity.userAgent);
    define('appVersion', identity.userAgent.replace(/^Mozilla\//, ''));
    define('platform', identity.platform);
    if (!navigator.userAgentData) return;
    const lowEntropy = () => ({
      brands: metadata.brands.map(brand => ({ ...brand })),
      mobile: true,
      platform: metadata.platform
    });
    const highEntropy: Record<string, unknown> = {
      architecture: metadata.architecture,
      bitness: metadata.bitness,
      model: metadata.model,
      platformVersion: metadata.platformVersion,
      uaFullVersion: metadata.fullVersion,
      fullVersionList: metadata.fullVersionList,
      wow64: metadata.wow64,
      formFactors: ['Mobile']
    };
    const data = Object.create(Object.getPrototypeOf(navigator.userAgentData));
    Object.defineProperties(data, {
      brands: { enumerable: true, get: () => lowEntropy().brands },
      mobile: { enumerable: true, get: () => true },
      platform: { enumerable: true, get: () => metadata.platform },
      toJSON: { value: lowEntropy },
      getHighEntropyValues: {
        value: async (hints: string[]) => {
          const values: Record<string, unknown> = lowEntropy();
          for (const hint of hints)
            if (Object.hasOwn(highEntropy, hint)) values[hint] = structuredClone(highEntropy[hint]);
          return values;
        }
      }
    });
    define('userAgentData', data);
  }
  document.addEventListener('pocket-mobile-profile-ready', apply);
  document.dispatchEvent(new Event('pocket-mobile-profile-request'));
})();
