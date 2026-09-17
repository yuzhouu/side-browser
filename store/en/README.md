# SideBrowser store assets

Open [../index.html](../index.html) to preview both the English and Simplified Chinese sets. Each language has five 1280 × 800 feature screenshots, one 440 × 280 promotional image, and one 1400 × 560 promotional banner. The 128 × 128 store icon is shared.

## Ready to use

- English copy: [listing.md](listing.md); English images: the eight PNG files in this folder.
- Simplified Chinese materials: [../zh-CN/](../zh-CN/), with its own listing, images, and guide.
- Store icon: `store-icon-128.png`, included in both language folders.
- English upload assets: `../../releases/sidebrowser-store-en-1.0.0.zip`.
- Chinese upload assets: `../../releases/sidebrowser-store-zh-CN-1.0.0.zip`.
- Complete preparation pack, including sources: `../../releases/sidebrowser-store-1.0.0.zip`.

Each language-specific ZIP contains eight PNGs, its listing copy, a checksum manifest, the bilingual privacy policy, and a short guide. Upload the extension itself separately using `sidebrowser-1.0.0.zip`; an assets ZIP is not an installable extension.

Use the English set for the default English listing and the Chinese set for the Simplified Chinese localization. Upload images 01–05 in numerical order, the small promotional image, the shared icon, and optionally the wide banner. Copy the corresponding name, short description, and detailed description from the listing file.

## Screenshot sources

Both sets use real website and extension screenshots, with localized captions outside the product UI. The English captures were taken on 2026-09-17 using Chrome for Testing 149 in an independent en-US profile, with the current `dist/` extension. The native side panel measured 360 × 645 CSS pixels at DPR 2. Source screenshots and capture receipts are in `../assets/source/en/`; Chinese sources and their original capture records remain in `../assets/source/`.

ChatGPT is shown signed out; no conversation was submitted. The English research image pairs Wikipedia's Time management and Pomodoro Technique articles. Google presented a CAPTCHA during English capture, so it was not used. Chinese research artwork retains its previously captured Wikipedia and Google example. These websites are examples, not a fixed supported-site list or an endorsement.

Upload the composed PNGs, not the raw source screenshots. No AI-generated interface elements or fabricated answers are used.

## Rebuild both languages

```sh
# Only when fresh English source captures are needed:
STORE_LOCALE=en npm run store:capture

# Render both sets from saved captures:
npm run store:render

# Validate and build the extension, both language packs, and complete preparation pack:
npm run store:package
```

Run these commands from the project root. Set `CHROME_PATH` to an installed Chrome for Testing executable if needed. The shared layout and Chinese copy live in `../design.html`; English copy and source mappings live in `../design-locales.js`. Open `../design.html?lang=en` to preview the English layout. Review every image at full size and reduced size after changing the layout.

The shared `../manifest.json` records each image's locale, dimensions, byte count, and SHA-256. Packaging verifies both complete language sets. Developer-dashboard permission explanations and submission notes are in `../submission.md`; the permission text to paste is already in English. Public privacy text is in `../../docs/privacy-policy.md`.

Preparation is local. Store submission and publication are separate actions.
