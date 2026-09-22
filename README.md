# SideBrowser

**Another page. Right beside you.**

English · [简体中文](README.zh-CN.md)

SideBrowser brings your favorite websites into the native side panel of Chrome and Microsoft Edge. Keep AI tools, search, references, and documents beside your main page while you write, read, or research.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/jlankbdlgdjliaccjkhccphfjmmpgkho) · [Website](https://yuzhouu.github.io/side-browser/en/) · [Feedback](https://github.com/yuzhouu/side-browser/issues)

## Keep your tools beside your work

- **Ask AI while you work.** Open a compatible AI website, type a question or paste material, and keep the original page in view. AI services are provided by the websites you choose; SideBrowser does not automatically send them your main page’s contents.
- **Look things up without losing your place.** Search, read documentation, or consult a reference alongside the page you are working on.
- **Continue browsing across tabs.** Unbound tabs in the same window share one running sidebar page. Switching between them preserves its input, scroll position, and page state. Closing the tab that originally supplied the URL leaves the shared sidebar open.
- **Give a tab its own companion page.** Bind the current sidebar page to a tab from the More menu. That tab keeps its own page and navigation history; other unbound tabs return to the welcome screen, where you can open a new shared page. Each browser window has its own shared page and history.

## Find and reopen pages quickly

- **One address bar for URLs and search.** Enter a website address or search keywords with Google, Bing, Baidu, or DuckDuckGo. Choose your preferred engine in Settings; Google is the default.
- **Suggestions as you type.** Find matches from SideBrowser favorites and recent pages, plus browser history and bookmarks. Suggestions show their source and support arrow keys, Enter, and Escape.
- **Favorites within reach.** Save the current page from the More menu, or save a webpage from the right-click menu. Favorites appear as website icons on the welcome screen; hover or focus to see the title and full URL, then click to open. SideBrowser favorites are separate from browser bookmarks.
- **Your 10 most recently opened addresses.** Reopen a page from the clock button beside the address bar, remove individual entries, or clear the list. Favorites and recent pages are shared across windows and kept after restarting the browser.

## Everyday browsing controls

Open the current webpage in one click, from the webpage or link context menu, or with **Alt + Shift + P** (**⌥ + ⇧ + P** on Mac). Use the compact toolbar to go back, go forward, enter an address, or close the current sidebar page.

Closing a page returns to the welcome screen while keeping favorites, recent pages, preferences, and any tab binding. You can also open the sidebar page in a regular tab from the More menu.

Choose **mobile or desktop view** and **light, dark, or system appearance**. These preferences apply across windows. Switching the view reloads running sidebar pages; changing the appearance does not. Website theme support depends on the site.

The interface follows your browser’s language and supports English, Simplified Chinese, Traditional Chinese, Japanese, German, French, and Spanish.

## Get started

1. Install SideBrowser from the [Chrome Web Store](https://chromewebstore.google.com/detail/jlankbdlgdjliaccjkhccphfjmmpgkho) in **Chrome 145 or later**.
2. Pin SideBrowser to the toolbar and click its icon to open the side panel.
3. Enter an address or search, or choose **Open current page**.

For Microsoft Edge, build the project or extract the release ZIP, open `edge://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select `dist/` or the extracted folder containing `manifest.json`. Use a current desktop Edge version with Chromium 145 or later. An Edge Add-ons listing has not been published yet.

SideBrowser is free to install and requires no SideBrowser account. Websites you open may require their own login or subscription. More help is available from **More → About & Help**.

## Your data stays under your control

SideBrowser stores favorites, recent pages, preferences, and page restoration data on your device. Address suggestions query browser history and bookmarks locally without modifying them. The extension does not upload your records to the developer or use telemetry or a developer-operated proxy. Website and search requests go to the services you choose.

See the [Privacy Policy](docs/privacy-policy.md) for details.

## Page compatibility and restoration

Some websites restrict embedded browsing or depend on login and third-party cookie settings. If a page does not work in the sidebar, use the More menu to open it in a regular tab. Mobile view adapts website display; it is not full device emulation.

While the sidebar remains open, switching tabs keeps its running pages in place. After closing the side panel or restarting the browser, saved URLs can be restored, but form input, scroll position, and unsent content are not guaranteed to survive. Tab bindings last for the current browser session; unbinding a tab or closing a bound tab closes its independent sidebar page.
