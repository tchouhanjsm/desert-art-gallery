# Etsy listing export import

The owner importer accepts the site's standard product-template CSV and Etsy's native **Listings Download** export. The Etsy path is non-destructive by default: preview does not write to MySQL, and a confirmed import creates draft products only.

## Preview first

With a disposable local MySQL database migrated and the local owner catalogue configured:

```bash
npm run db:import-products -- ./EtsyListingsDownload.csv
```

This command performs a read-only preview. A write requires both `--commit --confirm-local-import`, a strictly local MySQL target, an empty product table and a previously unused CSV content hash. Production mode and live/Hostinger-looking database targets are blocked.

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
