# Third-party font and typography policy

## Japanese-first storefront

The active public storefront stylesheet currently uses a system-font stack with Japanese glyph-aware candidates:

- UI: Noto Sans JP, Hiragino Kaku Gothic ProN, Yu Gothic, Meiryo, then sans-serif.
- Editorial display: Noto Serif JP, Yu Mincho, Hiragino Mincho ProN, then serif.

This is a fallback strategy, not a guarantee that a named font is installed on every device. The public redesign does not currently bundle a Japanese font package. Native glyph coverage, font weights, kinsoku shori, Latin/Japanese mixing and fallback consistency remain visual QA items.

## Legacy dependencies

The package manifest still contains the previous Latin Cormorant Garamond and DM Sans Fontsource dependencies from the earlier storefront direction. The Japanese-first root layout no longer loads the former font faces. Before removing unused dependencies, verify no admin, preview or other active module references them and reconcile package.json and package-lock.json.

## Candidate self-hosted Japanese family

Fontsource's Noto Sans JP variable package is a candidate for a later, measured bundle decision. The package advertises Japanese glyph subsets and SIL Open Font License 1.1. Review the exact version's package metadata, license file, subset CSS and resulting network/bundle size before adding it. Do not use an unpinned third-party CDN or runtime Google Fonts request as a shortcut.

Reference: [Fontsource Noto Sans JP package](https://www.npmjs.com/package/@fontsource-variable/noto-sans-jp).

## Release rules

- Record family, exact npm version, license, attribution and subset strategy before adding a font.
- Keep the license text and required attribution with redistributed fonts.
- Check that loaded files include the glyphs used in Japanese titles, UI, numerals and punctuation.
- Prefer subset-aware loading and measure actual transfer size; Japanese font files can materially affect page weight.
- No font change is accepted without mobile screenshots, line-wrap review and a production build.
