import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'icons/sidebrowser.svg');
const sizes = [16, 32, 48, 128, 256, 512, 1024];
const executable = process.env.RSVG_CONVERT || 'rsvg-convert';

// Render the approved SVG at every size using librsvg, without launching a browser.
for (const size of sizes) {
  const output = join(root, 'icons', `${size}.png`);
  try {
    await run(executable, [
      '--width',
      String(size),
      '--height',
      String(size),
      '--output',
      output,
      source
    ]);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('找不到 rsvg-convert。请安装 librsvg，或通过 RSVG_CONVERT 指定可执行文件。', {
        cause: error
      });
    }
    throw error;
  }
  const png = await readFile(output);
  if (
    png.length < 24 ||
    png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    png.readUInt32BE(16) !== size ||
    png.readUInt32BE(20) !== size
  ) {
    throw new Error(`PNG 格式或尺寸不匹配：${size}`);
  }
  console.log(`icons/${size}.png · ${size} × ${size}`);
}
