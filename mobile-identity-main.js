(() => {
  if (window === window.top || !location.ancestorOrigins[0]?.startsWith('chrome-extension://'))
    return;
  let installed = false;
  function apply(event) {
    if (installed) return;
    let profile;
    try {
      profile = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (
      !/^[a-p]{32}$/.test(profile.extensionId || '') ||
      location.ancestorOrigins[0] !== `chrome-extension://${profile.extensionId}`
    )
      return;
    const identity = profile.identity,
      metadata = identity?.userAgentMetadata;
    if (
      typeof identity?.userAgent !== 'string' ||
      !metadata?.mobile ||
      !Array.isArray(metadata.brands)
    )
      return;
    installed = true;
    document.removeEventListener('pocket-mobile-profile-ready', apply);
    const define = (key, value) =>
      Object.defineProperty(Navigator.prototype, key, {
        configurable: true,
        enumerable: true,
        get: () => value
      });
    define('userAgent', identity.userAgent);
    define('appVersion', identity.userAgent.replace(/^Mozilla\//, ''));
    define('platform', identity.platform);
    // Supply the virtual screen/viewport to site scripts. CSS layout is resized
    // by the parent iframe; pointer, hover and touch APIs keep their native values.
    let metrics = {
      deviceWidth: identity.screen.width,
      deviceHeight: identity.screen.height,
      scale: 1,
      dpr: identity.screen.dpr
    };
    const getter = (object, key, read) => {
      try {
        Object.defineProperty(object, key, { configurable: true, enumerable: true, get: read });
      } catch {}
    };
    getter(screen, 'width', () => metrics.deviceWidth);
    getter(screen, 'availWidth', () => metrics.deviceWidth);
    getter(screen, 'height', () => metrics.deviceHeight);
    getter(screen, 'availHeight', () => metrics.deviceHeight);
    getter(window, 'outerWidth', () => metrics.deviceWidth);
    getter(window, 'outerHeight', () => metrics.deviceHeight);
    getter(window, 'devicePixelRatio', () => metrics.dpr);
    if (screen.orientation) {
      getter(screen.orientation, 'type', () =>
        metrics.deviceWidth > metrics.deviceHeight ? 'landscape-primary' : 'portrait-primary'
      );
      getter(screen.orientation, 'angle', () =>
        metrics.deviceWidth > metrics.deviceHeight ? 90 : 0
      );
    }
    if (window.visualViewport) {
      getter(visualViewport, 'scale', () => metrics.scale);
      getter(visualViewport, 'width', () => document.documentElement.clientWidth);
      getter(visualViewport, 'height', () => document.documentElement.clientHeight);
    }
    document.addEventListener('pocket-mobile-metrics', event => {
      let next;
      try {
        next = JSON.parse(event.detail);
      } catch {
        return;
      }
      if (
        ![next.deviceWidth, next.deviceHeight, next.scale, next.dpr].every(
          n => Number.isFinite(n) && n > 0
        ) ||
        next.deviceWidth > 10000 ||
        next.deviceHeight > 50000 ||
        next.scale > 10 ||
        next.dpr > 10
      )
        return;
      const changed =
        metrics.scale !== next.scale ||
        metrics.deviceWidth !== next.deviceWidth ||
        metrics.deviceHeight !== next.deviceHeight;
      metrics = next;
      if (changed) window.visualViewport?.dispatchEvent(new Event('resize'));
    });
    if (!navigator.userAgentData) return;
    const lowEntropy = () => ({
      brands: metadata.brands.map(brand => ({ ...brand })),
      mobile: true,
      platform: metadata.platform
    });
    const highEntropy = {
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
        value: async hints => {
          const values = lowEntropy();
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
