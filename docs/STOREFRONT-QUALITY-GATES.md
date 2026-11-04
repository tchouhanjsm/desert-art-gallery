# Storefront visual and performance quality gates

## Local responsive visual review (Milestone 1)

Run the app with the normal local MySQL environment:

1. Terminal 1: `npm run dev`
2. Terminal 2: `npm run visual:review`

The script captures the homepage, shop, development product preview and cart at:
- 390 px mobile
- 768 px tablet
- 1440 px desktop

Screenshots are written to `.local-data/visual-review/<timestamp>/` and remain local; do not commit product originals, credentials or local data.

Review each viewport for:
- no horizontal overflow or clipped navigation;
- hero image legibility and the full-colour treatment;
- visible, readable product names, descriptions and actions;
- category filters and two-column mobile product cards;
- accordions and enquiry action on product detail;
- cart empty and populated states;
- keyboard focus, reduced-motion behavior and text contrast;
- no invented product facts or unlabelled preview artwork.

Capture and attach the resulting screenshot set to the PR before treating visual QA as complete.

## Automated performance review (Milestone 2)

CI runs Lighthouse in mobile emulation against the production homepage and shop routes. It stores HTML/JSON reports as a seven-day Actions artifact.

The current budgets are warnings while the image content and hosting environment are being finalized:
- mobile Largest Contentful Paint (LCP): target below 2,500 ms;
- Lighthouse performance score: target at least 0.80.

The measured values must be reviewed against the artifact rather than treated as a pass solely because the pipeline completed.

## Image delivery

- Public storefront images use the Next.js image optimizer and AVIF/WebP negotiation.
- Remote optimization is restricted to the configured Supabase storage origin and storage paths.
- A neutral SVG blur placeholder is used while images load.
- Owner-only preview endpoints remain unoptimized because they require session cookies; do not make those private endpoints publicly cacheable to optimize admin imagery.
- Original product imagery remains gated by image rights and descriptive alt text. Preview artwork must remain visibly identified as a placeholder.
