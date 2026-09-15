globalThis.__pocketPhone = Object.freeze({ width: 390, height: 844, dpr: 2 });
globalThis.__pocketMobileIdentity = function mobileIdentity(desktopUA) {
  const version = /(?:Chrome|Chromium)\/([\d.]+)/.exec(desktopUA)?.[1];
  if (!version) throw new Error('无法读取 Chrome 版本，手机模式未启用。');
  const major = version.split('.')[0];
  return {
    screen: { ...globalThis.__pocketPhone },
    userAgent: `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`,
    platform: 'Linux armv8l',
    userAgentMetadata: {
      brands: [{ brand: 'Chromium', version: major }, { brand: 'Google Chrome', version: major }, { brand: 'Not_A Brand', version: '99' }],
      fullVersionList: [{ brand: 'Chromium', version }, { brand: 'Google Chrome', version }, { brand: 'Not_A Brand', version: '99.0.0.0' }],
      fullVersion: version, platform: 'Android', platformVersion: '13.0.0',
      architecture: 'arm', model: 'Pixel 7', mobile: true, bitness: '64', wow64: false
    }
  };
};
