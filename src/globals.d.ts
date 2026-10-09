declare var __pocketNativeLinks: boolean | undefined;

interface DocumentEventMap {
  'pocket-mobile-profile-ready': CustomEvent<string>;
}

interface Navigator {
  readonly userAgentData?: object;
}
