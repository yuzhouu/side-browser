import test from 'node:test';
import assert from 'node:assert/strict';
import { fitViewport, parseViewport } from '../src/viewport.ts';
const fit = contents => fitViewport({ mode: 'mobile', width: 390, height: 760, contents });
test('NGA numeric viewport has the same layout width and scale as mobile Chrome', () => {
  const result = fit(['width=525']);
  assert.equal(result.width, 525);
  assert.equal(result.scale, 390 / 525);
  assert.equal(result.height, Math.ceil(760 / (390 / 525)));
});
test('responsive and legacy pages receive their respective mobile layout viewports', () => {
  assert.equal(fit(['width=device-width,initial-scale=1']).width, 390);
  assert.equal(fit([]).width, 980);
  assert.equal(fit(['initial-scale=1']).width, 390);
});
test('late metadata overrides earlier descriptors and initial scale extends the viewport', () => {
  assert.equal(fit(['width=device-width', 'width=700']).width, 700);
  assert.equal(fit(['width=device-width, initial-scale=0.5']).width, 780);
  assert.deepEqual(parseViewport(['WIDTH=525; INITIAL-SCALE=1']), { width: 525, initialScale: 1 });
});
test('malformed or extreme site hints cannot produce nonfinite frame dimensions', () => {
  assert.deepEqual(parseViewport(['width=NaN,initial-scale=-1']), {});
  const result = fit(['width=999999999,initial-scale=0']);
  assert.equal(result.width, 10000);
  assert(Number.isFinite(result.height));
});
test('desktop mode removes mobile layout, screen size and scale adjustments', () => {
  assert.deepEqual(
    fitViewport({ mode: 'desktop', width: 560, height: 760, contents: ['width=525'] }),
    { deviceWidth: 560, deviceHeight: 760, width: 560, height: 760, scale: 1 }
  );
});
test('resizing a narrow panel adapts the scale instead of changing the declared layout width', () => {
  const result = fitViewport({ mode: 'mobile', width: 320, height: 600, contents: ['width=525'] });
  assert.equal(result.width, 525);
  assert.equal(result.deviceWidth, 320);
  assert.equal(result.scale, 320 / 525);
});
