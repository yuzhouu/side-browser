const root = document.documentElement;
const themeButton = document.querySelector('[data-theme-toggle]');
const themeLabels = JSON.parse(themeButton.dataset.labels);
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let chosenTheme;
try {
  chosenTheme = localStorage.getItem('sidebrowser-site-theme');
} catch {}
function updateTheme(theme) {
  root.dataset.theme = theme;
  themeButton.setAttribute('aria-label', theme === 'dark' ? themeLabels.light : themeLabels.dark);
  themeButton.title = themeButton.getAttribute('aria-label');
  window.dispatchEvent(new Event('site-theme-change'));
}
updateTheme(root.dataset.theme || 'light');
themeButton.addEventListener('click', () => {
  chosenTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('sidebrowser-site-theme', chosenTheme);
  } catch {}
  updateTheme(chosenTheme);
});
systemTheme.addEventListener('change', event => {
  if (!chosenTheme) updateTheme(event.matches ? 'dark' : 'light');
});

const data = JSON.parse(document.querySelector('#page-data').textContent);
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
sceneButtons.forEach(button =>
  button.addEventListener('click', () => {
    const index = Number(button.dataset.scene);
    sceneButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const screenshot = document.querySelector('#hero-screenshot');
    screenshot.src = `${data.base}assets/source/${data.scenes[index]}.png`;
    screenshot.alt = data.copy.screenshotAlt[index];
    document.querySelector('#hero-main-screenshot').src =
      `${data.base}assets/source/${data.mainScenes[index]}.png`;
    document.querySelector('#hero-main-screenshot').alt = data.copy.mainLabels[index];
    document.querySelector('#hero-main-label').textContent = data.copy.mainLabels[index];
    document.querySelector('#hero-side-label').textContent = data.copy.sideLabels[index];
    document.querySelector('#scene-caption').textContent = data.copy.sceneNotes[index];
  })
);

const copyButton = document.querySelector('[data-copy]');
copyButton?.addEventListener('click', async () => {
  const field = document.querySelector('#product-copy');
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(field.value);
    status.textContent = data.copy.copied;
  } catch {
    field.focus();
    field.select();
    status.textContent = data.copy.copyFailed;
  }
});

const canvas = document.querySelector('#artwork');
if (canvas) {
  const context = canvas.getContext('2d', { alpha: false });
  const selector = document.querySelector('#scene-select');
  const exportButton = document.querySelector('#export-image');
  const status = document.querySelector('#export-status');
  const copy = data.copy;
  const imageCache = new Map();
  let renderVersion = 0;
  let ready = false;
  function loadImage(path) {
    if (!imageCache.has(path)) {
      imageCache.set(
        path,
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = path;
        })
      );
    }
    return imageCache.get(path);
  }
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
  function text(value, x, y, size, color, weight = 400) {
    context.font = `${weight} ${size}px ${font}`;
    context.fillStyle = color;
    context.fillText(value, x, y);
  }
  function rounded(x, y, width, height, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
  }
  async function renderArtwork() {
    const current = ++renderVersion;
    ready = false;
    exportButton.disabled = true;
    status.textContent = '';
    try {
      const index = Number(selector.value);
      const [shot, mainShot, logo] = await Promise.all([
        loadImage(`${data.base}assets/source/${data.scenes[index]}.png`),
        loadImage(`${data.base}assets/source/${data.mainScenes[index]}.png`),
        loadImage(`${data.base}assets/sidebrowser.svg`),
        document.fonts.ready
      ]);
      if (current !== renderVersion) return;
      const dark = root.dataset.theme === 'dark';
      const ink = dark ? '#e7f1f8' : '#18354d';
      const muted = dark ? '#adc1d2' : '#587086';
      const blue = dark ? '#64baff' : '#087de0';
      context.clearRect(0, 0, 1280, 800);
      context.fillStyle = dark ? '#10212f' : '#ffffff';
      context.fillRect(0, 0, 1280, 800);
      context.drawImage(logo, 48, 30, 34, 34);
      text(copy.name, 96, 56, 23, ink, 700);
      context.textAlign = 'right';
      text(copy.artworkExample, 1232, 54, 16, muted);
      context.textAlign = 'left';
      text(copy.realCapture, 48, 786, 12, muted);
      const heading = copy.artworkHeadings[index].join(data.locale === 'zh' ? '' : ' ');
      text(heading, 48, 128, data.locale === 'zh' ? 46 : 43, ink, 750);
      text(copy.artworkBodies[index], 50, 174, 20, muted);

      // One shared frame makes the main-page/sidebar relationship explicit.
      // Crop only the bottom of the wide main-page capture; keep screenshot aspect ratios.
      const frameX = 48,
        frameY = 208,
        frameWidth = 1184;
      const labelHeight = 40,
        bodyHeight = 474;
      const sideWidth = (shot.width * bodyHeight) / shot.height;
      const mainWidth = frameWidth - sideWidth - 8;
      const sideX = frameX + mainWidth + 8;
      rounded(
        frameX,
        frameY,
        frameWidth,
        labelHeight + bodyHeight,
        12,
        dark ? '#263f50' : '#e9f1f7'
      );
      rounded(frameX + 14, frameY + 11, 20, 20, 10, '#f4c94d');
      text('1', frameX + 20, frameY + 26, 13, '#18354d', 700);
      text(copy.mainLabels[index], frameX + 44, frameY + 27, 16, ink, 600);
      rounded(sideX + 10, frameY + 11, 20, 20, 10, '#f4c94d');
      text('2', sideX + 16, frameY + 26, 13, '#18354d', 700);
      text(copy.sideLabels[index], sideX + 40, frameY + 27, 16, ink, 600);
      context.save();
      context.beginPath();
      context.roundRect(frameX, frameY, frameWidth, labelHeight + bodyHeight, 12);
      context.clip();
      context.save();
      context.beginPath();
      context.rect(frameX, frameY + labelHeight, mainWidth, bodyHeight);
      context.clip();
      context.drawImage(
        mainShot,
        frameX,
        frameY + labelHeight,
        mainWidth,
        (mainShot.height * mainWidth) / mainShot.width
      );
      context.restore();
      context.drawImage(shot, sideX, frameY + labelHeight, sideWidth, bodyHeight);
      context.restore();
      copy.artworkPoints[index].forEach((point, i) => {
        const x = 48 + i * 400;
        text('✓', x, 758, 18, blue, 700);
        text(point, x + 27, 758, data.locale === 'zh' ? 19 : 16, ink, 500);
      });
      canvas.setAttribute(
        'aria-label',
        `${copy.artworkHeadings[index].join(' ')} ${copy.artworkBodies[index]} ${copy.examplesNote}`
      );
      ready = true;
      exportButton.disabled = false;
    } catch {
      if (current === renderVersion) status.textContent = copy.exportError;
    }
  }
  selector.addEventListener('change', renderArtwork);
  window.addEventListener('site-theme-change', renderArtwork);
  exportButton.addEventListener('click', () => {
    if (!ready) return;
    canvas.toBlob(blob => {
      if (!blob) {
        status.textContent = copy.exportError;
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sidebrowser-${data.scenes[Number(selector.value)]}-${data.locale}-${root.dataset.theme}-1280x800.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      status.textContent = copy.exportDone;
    }, 'image/png');
  });
  renderArtwork();
}
