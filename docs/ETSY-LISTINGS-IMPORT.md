# Etsy listing export import

The owner importer accepts the site's standard product-template CSV and Etsy's native **Listings Download** export. The Etsy path is non-destructive by default: preview does not write to MySQL, and a confirmed import creates draft products only.

## Preview first

With a disposable local MySQL database migrated and the local owner catalogue configured:

```bash
npm run db:import-products -- ./EtsyListingsDownload.csv
```

This command performs a read-only preview. A write requires both `--commit --confirm-local-import`, a strictly local MySQL target, an empty product table and a previously unused CSV content hash. Production mode and live/Hostinger-looking database targets are blocked. The `/admin/products/import` owner page provides the same preview-and-confirm workflow in MySQL mode. Staging writes additionally require `APP_ENV=staging` and `STAGING_CATALOGUE_IMPORT_ENABLED=true` on an isolated staging host; the database URL must still resolve to loopback and must not be production/live/Hostinger. Separately, `db:migrate` refuses to initialize any database that already has tables/views but lacks the Drizzle migration journal; use a verified empty local database rather than attempting to overwrite a legacy schema.

## Field mapping

| Etsy field | Catalogue destination |
| --- | --- |
| `TITLE` | Product title; a row-specific stable slug keeps repeated-title listings separate. |
| `DESCRIPTION` | Product description; first non-empty line becomes the short description. |
| `PRICE` + `CURRENCY_CODE` | Integer minor-unit price and currency. No exchange conversion is performed. |
| `QUANTITY` | Opening quantity on the Standard variant and one opening inventory-ledger movement. |
| `MATERIALS` | Product materials array. |
| `TAGS` | Product tags array. |
| `SKU` | Assigned only when non-empty and unique in the export. Blank or duplicated values are retained in source metadata for owner reconciliation. |
| `IMAGE1`–`IMAGE10` | HTTPS URLs on Etsy's exact static-image host are retained as private source metadata and previewed in the owner product editor. Image bytes are not copied. |
| `VARIATION 1`–`VARIATION 3` | Variation names and values retained as source metadata; stock-bearing variants are not guessed. |

Etsy's export does not supply listing IDs or listing status. For that reason, each row is treated as a distinct product draft. The import does not infer categories, item condition, provenance, measurements, one-of-a-kind status or image permissions.

## Images and publication

Source photo URLs remain references only. The owner can open an image reference, obtain an authorized original, and upload it through the existing private product-media upload control. The uploaded file remains private until the owner adds descriptive alt text and explicitly records rights evidence. The CSV import does not approve rights or expose external images on the public storefront.

## Supplied export observations

The provided export contains 527 listing rows, all denominated in USD and with quantity 1. It has 60 blank SKU cells and 13 SKU values used by more than one row. There are no populated variation values and no listing ID/status columns. The migration raises the import-batch ceiling to 1,000 rows so this export can be previewed as a single batch. Repeated SKUs are preserved in source metadata and left unset in the unique variant-SKU field.


## Uploaded Etsy export audit — 2026-11-04

The owner supplied the source CSV for this redesign. It was inspected directly; the file is not committed to Git.

- 527 listing rows and 27 columns; every row has a title and non-empty description.
- USD is the only source currency; each row has quantity 1.
- 5,216 non-empty image URL references across IMAGE1–IMAGE10. Each listing has at least two references; 496 rows have all ten slots populated.
- 60 blank SKU rows; 13 duplicate SKU groups affecting 26 rows; 455 distinct non-blank SKU values.
- 316 distinct title strings. 59 title groups repeat, covering 270 rows. The generic title "Unisex Handmade Tribal Jacket Collection Piece" appears 53 times.
- MATERIALS is populated on 452 rows; TAGS is populated on all rows.
- No explicit category/section column exists. All three Etsy variation groups are empty.
- Numeric source price range is USD 119–3,780.

### Implementation consequences

- The export itself is source data, not an import result. Do not imply products, variants or images have been loaded.
- Do not use title-only matching as a general identity join. Repeated generic titles are common.
- A unique source SKU is supporting evidence only; blank or duplicate SKU rows need owner review.
- 5,216 URL cells are not necessarily 5,216 unique image files, nor proof that Etsy-hosted photos match the earlier recovered local archive.
- The previously reported local recovery archive inventory (315 folders / 3,116 files / approximately 2.34 GB / 45 duplicate SHA groups / 92 files) is a historical snapshot. Rerun the photo audit before any staging.
- The source has no explicit categories or variations. Do not invent taxonomy, purchasable variants, rankings or sizes from tags/materials alone.
- Product copy is English and source prices are USD. Do not machine-translate product claims, convert to JPY, add tax-inclusive language or publish until merchant-approved Japan-market content/pricing/tax is supplied.
- All products remain drafts; image identity and commercial usage rights remain separate owner approvals.

### Japan-market implementation rules

1. Preserve English source titles/descriptions until Japanese product content is entered and reviewed by a qualified Japanese-language reviewer. Do not machine-translate material, provenance, condition, maker or care claims.
2. Do not assume USD is the Japanese retail price. No JPY conversion, tax-inclusive label, markup or discount may be inferred. Japan-market price and tax policy are separate merchant decisions.
3. Do not derive a primary category from tags without an owner-approved taxonomy. This export has no Etsy category column.
4. Do not identify listings by title alone. Repeated titles are common, including a generic title used by 53 rows. Use a unique source SKU as supporting evidence; blank/duplicate SKUs need independent review.
5. The variation columns are empty, so this export provides no size/colour/other option data from which to create sellable variants.
6. Imported products remain drafts. The SHA-256 preview/commit gate remains mandatory; import does not download photo bytes, approve rights or publish products.
