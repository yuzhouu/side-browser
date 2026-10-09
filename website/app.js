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
const languageMenu = document.querySelector('.language-menu');
const languageLinks = [...document.querySelectorAll('[data-locale]')];
function updateLanguageLinks() {
  languageLinks.forEach(link => {
    const target = new URL(link.href);
    target.search = location.search;
    target.hash = location.hash;
    link.href = target.href;
  });
}
updateLanguageLinks();
window.addEventListener('hashchange', updateLanguageLinks);
languageLinks.forEach(link => {
  link.addEventListener('click', () => {
    try {
      localStorage.setItem('sidebrowser-site-language', link.dataset.locale);
    } catch {}
  });
});
document.addEventListener('click', event => {
  if (!languageMenu.contains(event.target)) languageMenu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && languageMenu.open) {
    languageMenu.open = false;
    languageMenu.querySelector('summary').focus();
  }
});
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
