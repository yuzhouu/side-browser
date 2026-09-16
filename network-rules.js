import { mobileIdentity } from './config.js';
export const PANEL_RULE_IDS = [1, 2, 3];
export function panelRules(extensionId, mode, userAgent) {
  // Chrome 145+: scope to this extension's non-tab document tree, including
  // native navigations whose initiator is now the embedded website.
  const requests = { tabIds: [-1], topDomains: [extensionId] };
  const documents = { ...requests, resourceTypes: ['sub_frame'] };
  const rules = [
    {
      id: 1,
      priority: 1,
      condition: documents,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: 'x-frame-options', operation: 'remove' }]
      }
    },
    {
      id: 2,
      priority: 1,
      condition: {
        ...documents,
        responseHeaders: [{ header: 'content-security-policy', values: ['*frame-ancestors*'] }]
      },
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: 'content-security-policy', operation: 'remove' }]
      }
    }
  ];
  // DNR cannot remove one CSP directive; only a header declaring embedding
  // restrictions is removed. Responses without an embedding restriction keep their CSP unchanged.
  if (mode === 'mobile') {
    const identity = mobileIdentity(userAgent),
      metadata = identity.userAgentMetadata;
    const brands = list => list.map(item => `"${item.brand}";v="${item.version}"`).join(', ');
    rules.push({
      id: 3,
      priority: 1,
      condition: requests,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'user-agent', operation: 'set', value: identity.userAgent },
          { header: 'sec-ch-ua', operation: 'set', value: brands(metadata.brands) },
          { header: 'sec-ch-ua-mobile', operation: 'set', value: '?1' },
          { header: 'sec-ch-ua-platform', operation: 'set', value: '"Android"' },
          {
            header: 'sec-ch-ua-platform-version',
            operation: 'set',
            value: JSON.stringify(metadata.platformVersion)
          },
          { header: 'sec-ch-ua-model', operation: 'set', value: JSON.stringify(metadata.model) },
          {
            header: 'sec-ch-ua-arch',
            operation: 'set',
            value: JSON.stringify(metadata.architecture)
          },
          {
            header: 'sec-ch-ua-bitness',
            operation: 'set',
            value: JSON.stringify(metadata.bitness)
          },
          {
            header: 'sec-ch-ua-full-version',
            operation: 'set',
            value: JSON.stringify(metadata.fullVersion)
          },
          {
            header: 'sec-ch-ua-full-version-list',
            operation: 'set',
            value: brands(metadata.fullVersionList)
          },
          { header: 'sec-ch-ua-wow64', operation: 'set', value: '?0' }
        ]
      }
    });
  }
  return rules;
}
