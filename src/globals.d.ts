declare var __pocketNativeLinks: boolean | undefined;

interface DocumentEventMap {
  'pocket-mobile-profile-ready': CustomEvent<string>;
  'pocket-mobile-metrics': CustomEvent<string>;
}

interface Navigator {
  readonly userAgentData?: object;
}
