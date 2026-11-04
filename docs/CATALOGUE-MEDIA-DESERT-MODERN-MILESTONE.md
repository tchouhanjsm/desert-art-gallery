# Catalogue, recovered photography and Desert Modern storefront milestone

## Objective

Build the live catalogue from the owner's Etsy Listings Download export and attach the corresponding recovered original photographs to the correct draft products. Refresh the public storefront with the **Desert Modern** visual identity.

This milestone is intentionally split into deterministic, auditable steps. The 527-row Etsy export and the recovered photo folders are source assets; they are not assumed to be perfectly aligned. A successful CSV parse or title match is not proof of product identity or image rights.

## Current source inventory (last owner-verified local audit)

- Etsy export: `/Users/home/Downloads/Etsy Photo Recovery/EtsyListingsDownload.csv`
- 527 listing rows; 60 blank SKU values; 13 duplicated SKU values in the export.
- Recovered originals: 315 product folders, 3,116 image files, approximately 2.34 GB.
- 45 duplicate groups / 92 duplicate files were reported. No duplicate originals are automatically removed.
- Local MySQL catalogue was last verified empty (0 products, variants, media records and import batches) after schema migrations.
- The source export and original recovery folders remain local. They are not committed to Git.

Re-run the audit before acting; these counts are a previous snapshot, not a guarantee that local files have not changed.

## Storage boundaries

| Asset | Canonical location |
| --- | --- |
| Application, migrations, import logic, tests and non-sensitive taxonomy rules | Git |
| Etsy export and raw owner-review reports | `.local-data/imports` and `.local-data/recovery/reports` (ignored) |
| Recovered originals | Existing recovery folder / `public/images/products` (preserve originals; ignored by Git) |
| Approved intake copies | `.local-data/imports/product-images/<verified-product-slug>` |
| Local product/catalogue records | Local MySQL |
| Private approved product objects | Private S3-compatible media storage (Cloudflare R2 in hosted environments) |
| Public storefront delivery | Existing authenticated media route / approved public delivery configuration |

Do not add the 2.34 GB originals to Git or Git LFS. Do not make the R2 bucket public merely to simplify upload. The application already has a local/S3-compatible storage adapter and environment configuration; reuse it.

## Catalogue import sequence

1. Confirm the local target using `npm run db:catalogue-preflight`. Stop if the database is not the intended local database, if products/import batches already exist, or if migrations are incomplete.
2. Preview the exact export:
   ```bash
   npm run db:import-products -- "/Users/home/Downloads/Etsy Photo Recovery/EtsyListingsDownload.csv"
   ```
3. Review all row errors and warnings, especially zero/invalid prices, duplicated SKUs, missing photos and preserved Etsy variation metadata. The preview must show the expected source row count and `canCommit: true`.
4. Commit only to the verified empty local MySQL database, after the preview has been inspected:
   ```bash
   npm run db:import-products -- "/Users/home/Downloads/Etsy Photo Recovery/EtsyListingsDownload.csv" --commit --confirm-local-import
   ```
5. Products remain drafts. Preserve all Etsy source metadata and original export data. Do not manufacture product measurements, provenance, condition, maker biographies, material details or variant combinations.

### Category and collection mapping

The importer intentionally does not invent a category: Etsy rows currently enter with `category_slug: null`. Build a separate owner-reviewed mapping from the actual exported category/section/tags and the gallery's approved taxonomy. Preserve the raw Etsy source fields and map to active `product_categories` only after the owner confirms the meaning. Collections are editorial groupings, not inferred product categories. Unmapped listings remain drafts and searchable only in the owner workspace.

### Product identity and duplicate handling

- Etsy listing rows remain separate product drafts.
- Duplicate or blank SKUs stay in source metadata and are not used as unique variant SKUs.
- Do not merge listings solely because titles, prices or images look similar.
- Etsy variations are source metadata today; create sellable variants only after owner verification of option names, values, price and stock semantics.
- The original CSV hash and import batch record provide idempotency protection. Never bypass the existing duplicate-import gate to repeat an import.

## Photo matching and intake

1. Run `npm run media:audit-recovered` and retain all three reports in the ignored recovery report directory.
2. Review the folder-to-product mapping CSV. The existing mapper deliberately uses conservative exact-title matching; ranked suggestions are hints only.
3. For every product folder, explicitly select the catalogue product ID/slug and primary image. Mark the row `APPROVED` only after visually confirming that the recovered photos depict that exact listing. Add an owner note for manual overrides.
4. Preview staging:
   ```bash
   npm run media:stage-recovered -- ./.local-data/recovery/reports/recovered-photo-mapping-review-YYYY-MM-DD.csv
   ```
5. Only after the preview is clean, stage approved copies:
   ```bash
   npm run media:stage-recovered -- ./.local-data/recovery/reports/recovered-photo-mapping-review-YYYY-MM-DD.csv --commit --confirm-recovered-photo-staging
   ```
6. Review the private media-import preview and upload approved media through the existing importer and configured storage driver. For hosted staging, configure the private R2 bucket and credentials in the deployment environment, never in Git.
7. Verify every media row against its product ID, object key, MIME, byte size, SHA-256, image dimensions, order and primary flag. A product must not be published if its primary image is missing, mapping is uncertain, or usage rights are unconfirmed.

The recovery workflow copies approved images; it never moves, renames, edits or deletes the original archive. Duplicate files are reported, not automatically removed.

## Rights and publication gate

A matching photograph is not a rights approval. Keep `rightsConfirmed=false` until the owner records explicit usage evidence. Keep products unpublished until product identity, price, availability, description, primary photo, alt text and rights are checked. Do not copy Etsy listing copy into a new commercial context without confirming the gallery may reuse it.

## New storefront identity: Desert Modern

The previous warm neutral / clay palette is replaced by an archival gallery direction:

- **Midnight indigo** — structural navigation, typography and story panels.
- **Sun-washed parchment** — primary page canvas.
- **Sandstone** — collection and information surfaces.
- **Oxidised terracotta** — restrained commerce/action accent.
- **Desert brass** — editorial highlights and fine rules.

The design remains photo-led: generous image fields, restrained navigation, editorial typography, crisp product metadata and strong mobile layouts. The existing commerce, account, cart, checkout and admin behavior is not changed by the theme layer. Abstract artwork remains labelled as design study; it must never masquerade as product photography.

## Acceptance gates

- [ ] Etsy CSV preview reviewed against the actual 527 source rows.
- [ ] Draft import committed once to the verified local MySQL database.
- [ ] Category/collection mapping reviewed against real Etsy export values.
- [ ] All 315 recovery folders audited; ambiguous folders explicitly held.
- [ ] Every staged image has a verified product mapping and checksum.
- [ ] Private media upload verified in the configured storage backend.
- [ ] No product published before rights and content review.
- [ ] Desktop, tablet and mobile storefront screenshots inspected.
- [ ] Typecheck, lint, unit/integration tests and production build pass.
- [ ] Lighthouse mobile report reviewed; measured LCP is recorded rather than inferred from workflow success.
