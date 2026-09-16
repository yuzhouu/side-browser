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
  function wrap(value, x, y, maxWidth, lineHeight, size, color) {
    context.font = `400 ${size}px ${font}`;
    const pieces = data.locale === 'zh' ? [...value] : value.split(/(?<=\s)/);
    let line = '';
    for (const piece of pieces) {
      if (context.measureText(line + piece).width > maxWidth && line) {
        text(line.trim(), x, y, size, color);
        y += lineHeight;
        line = piece;
      } else line += piece;
    }
    if (line) text(line.trim(), x, y, size, color);
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
      const [shot, logo] = await Promise.all([
        loadImage(`${data.base}assets/source/${data.scenes[index]}.png`),
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
      rounded(696, 30, 554, 740, 24, dark ? '#193549' : '#edf7ff');
      context.fillStyle = '#f4c94d';
      context.beginPath();
      context.arc(813, 272, 105, 0, Math.PI * 2);
      context.fill();
      context.drawImage(logo, 56, 54, 44, 44);
      text(copy.name, 114, 85, 26, ink, 700);
      const headingSize = data.locale === 'zh' ? 64 : 56;
      text(copy.artworkHeadings[index][0], 56, 226, headingSize, ink, 750);
      text(copy.artworkHeadings[index][1], 56, 309, headingSize, blue, 750);
      wrap(copy.artworkBodies[index], 59, 376, 576, 36, 23, muted);
      copy.artworkPoints[index].forEach((point, i) => {
        rounded(59, 485 + i * 55, 28, 28, 14, '#f4c94d');
        text(String(i + 1), 68, 505 + i * 55, 17, '#18354d', 700);
        text(point, 104, 507 + i * 55, 22, ink, 500);
      });
      text(copy.artworkFooter, 59, 735, 17, muted);
      text(copy.realCapture, 880, 746, 14, muted);
      // Preserve the original website pixels and aspect ratio; only frame the capture.
      const shotHeight = 645;
      const shotWidth = (shot.width * shotHeight) / shot.height;
      const shotX = 974 - shotWidth / 2;
      context.save();
      context.shadowColor = '#17365326';
      context.shadowBlur = 30;
      context.shadowOffsetY = 10;
      rounded(shotX, 65, shotWidth, shotHeight, 8, '#fff');
      context.restore();
      context.save();
      context.beginPath();
      context.roundRect(shotX, 65, shotWidth, shotHeight, 8);
      context.clip();
      context.drawImage(shot, shotX, 65, shotWidth, shotHeight);
      context.restore();
      canvas.setAttribute(
        'aria-label',
        `${copy.artworkHeadings[index].join(' ')} ${copy.artworkBodies[index]}`
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
