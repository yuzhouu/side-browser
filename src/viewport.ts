import type { FrameMessage, Mode } from './types.js';
import { PHONE } from './config.js';
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export function parseViewport(contents: unknown[] = []) {
  const result: { width?: number | 'device-width'; initialScale?: number } = {};
  for (const content of contents.slice(0, 64)) {
    if (typeof content !== 'string') continue;
    for (const match of content.slice(0, 4096).matchAll(/([\w-]+)\s*=\s*([^\s,;]+)/g)) {
      const key = match[1].toLowerCase(),
        value = match[2].toLowerCase();
      if (key === 'width') {
        const number = parseFloat(value);
        if (value === 'device-width') result.width = value;
        else if (Number.isFinite(number) && number > 0) result.width = clamp(number, 1, 10000);
      } else if (key === 'initial-scale') {
        const number = parseFloat(value);
        if (Number.isFinite(number) && number > 0) result.initialScale = clamp(number, 0.1, 10);
      }
    }
  }
  return result;
}

export function fitViewport({
  mode,
  width,
  height,
  contents = []
}: {
  mode?: Mode;
  width: number;
  height: number;
  contents?: unknown[];
}) {
  const availableWidth = Math.max(1, Number(width) || 1),
    availableHeight = Math.max(1, Number(height) || 1);
  if (mode !== 'mobile')
    return {
      deviceWidth: availableWidth,
      deviceHeight: availableHeight,
      width: availableWidth,
      height: availableHeight,
      scale: 1
    };
  const deviceWidth = Math.min(PHONE.width, availableWidth),
    deviceHeight = availableHeight;
  const viewport = parseViewport(contents);
  // With no viewport hint, mobile browsers lay out legacy sites at about 980px.
  // A declared width is a minimum; initial-scale may extend the layout viewport.
  const declared = viewport.width === 'device-width' ? deviceWidth : viewport.width;
  const initial = viewport.initialScale;
  const logicalWidth = Math.ceil(
    clamp(
      Math.max(declared || (initial ? deviceWidth / initial : 980), deviceWidth / (initial || 1)),
      1,
      10000
    )
  );
  // Fit the entire layout width in this non-touch panel; no hidden pinch/pan area.
  const scale = deviceWidth / logicalWidth;
  return {
    deviceWidth,
    deviceHeight,
    width: logicalWidth,
    height: Math.ceil(deviceHeight / scale),
    scale,
    dpr: PHONE.dpr
  };
}

export class PanelViewport {
  frame: HTMLIFrameElement;
  stage: HTMLElement;
  mode: () => Mode | undefined;
  contents: string[];
  documentId: string | null;
  origin: string | null;
  resize: ResizeObserver;
  fit?: ReturnType<typeof fitViewport>;
  constructor(frame: HTMLIFrameElement, stage: HTMLElement, mode: () => Mode | undefined) {
    this.frame = frame;
    this.stage = stage;
    this.mode = mode;
    this.contents = [];
    this.documentId = null;
    this.origin = null;
    this.resize = new ResizeObserver(() => this.apply());
    this.resize.observe(stage.parentElement!);
    this.apply();
  }
  navigate() {
    this.documentId = null;
    this.origin = null;
    this.contents = [];
    this.apply();
  }
  accept(data: FrameMessage, origin: string) {
    if (
      !['POCKET_LOCATION', 'POCKET_VIEWPORT'].includes(data?.type) ||
      typeof data.documentId !== 'string' ||
      !Array.isArray(data.viewport)
    )
      return;
    if (data.type === 'POCKET_VIEWPORT' && data.documentId !== this.documentId) return;
    this.documentId = data.documentId;
    this.origin = origin;
    this.contents = data.viewport;
    this.apply();
  }
  apply() {
    const parent = this.stage.parentElement!;
    const mobile = this.mode() === 'mobile';
    const fit = fitViewport({
      mode: this.mode(),
      width: parent.clientWidth,
      height: parent.clientHeight,
      contents: this.contents
    });
    this.stage.style.width = `${fit.deviceWidth}px`;
    Object.assign(this.frame.style, {
      width: `${fit.width}px`,
      height: `${fit.height}px`,
      transform: `scale(${fit.scale})`
    });
    this.fit = fit;
    if (this.documentId && this.origin)
      this.frame.contentWindow?.postMessage(
        { type: 'POCKET_VIEWPORT_METRICS', documentId: this.documentId, mobile, ...fit },
        this.origin
      );
  }
}
