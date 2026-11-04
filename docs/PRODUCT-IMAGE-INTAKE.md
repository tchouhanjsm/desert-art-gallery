# Product photography intake

The product photography workspace is private and excluded from Git. It is an intake area, not a public web directory and not a direct database import mechanism.

## Prepare the folders

From the repository root:

~~~bash
npm run local:prepare
~~~

The script creates:

~~~text
.local-data/
  media/                         # approved application-managed media
  imports/
    product-images/
      <verified-product-slug>/
    etsy/
  backups/
    mysql/
    media/
~~~

All .local-data/ content remains ignored by Git. Never place private customer information, credentials or unrelated personal photographs in the intake folder.

## Folder and filename convention

Use the exact product slug shown in the owner product editor. Create one folder per catalogue product:

~~~text
.local-data/imports/product-images/
  antique-rajasthani-jacket/
    01-primary.jpg
    02-detail.webp
    03-back.jpg
    04-label.jpg
    05-texture.jpg
~~~

Supported image formats are JPEG, PNG, WebP and AVIF. The current upload limit is 12 MB per image. Allowed image roles are **primary**, **detail**, **back**, **label**, **texture** and **packaging**. Use sequence numbers 01 through 99; each product folder must contain exactly one 01-primary file.

Do not place an image into a product folder until its product slug has been verified. Do not infer provenance, artisan identity, materials, condition or measurements from the filename.

## Preview before upload

Run:

~~~bash
npm run media:preview
~~~

The preview checks folder slugs, filenames, duplicate sequence numbers, file sizes, file signatures and extension/MIME agreement. It skips macOS metadata sidecars. It does not connect to MySQL and does not upload, copy, publish or change any file.

A clean preview is only an intake-format check. It does not verify product identity, image quality, copyright, model releases, consent, provenance or commercial usage rights.

## Download source photographs directly from Etsy

The Etsy CSV importer retains approved `IMAGE1`–`IMAGE10` source URLs in each product's private source metadata. After the Etsy products have been imported as drafts, inspect the database-aware download preview:

~~~bash
npm run media:download-etsy
~~~

The preview lists the Etsy draft products, available photo counts, previous downloads and any blocked rows. It makes no network requests and writes no local files.

After checking the preview, explicitly download the photos:

~~~bash
npm run media:download-etsy -- --download --confirm-etsy-download
~~~

Downloads are restricted to HTTPS URLs on `i.etsystatic.com`. Redirects must remain on that exact host. The downloader has a 15-second request timeout, a three-redirect maximum, a 12 MB per-image limit, and verifies the returned MIME type against the actual JPEG/PNG/WebP/AVIF file signature. It does not follow links to other hosts or download arbitrary URLs.

Images are written into the matching product-slug folder using `01-primary`, `02-detail`, etc. A private `.etsy-download-manifest.json` records the source URL digest and file checksum. Re-running the command skips unchanged, verified downloads. Changed source URLs and collisions with manually supplied photographs are blocked rather than silently overwriting files.

The downloader only stages image files. It does not create public media records, change product data, approve image rights or publish products. After inspecting the staged photographs, use the database-aware intake preview and import commands below to attach them to the matching MySQL draft products.

## Recovered Etsy product-folder mapping

Use this workflow when original Etsy photographs have been recovered into title-named folders under `public/images/products/`.

First run the read-only mapping preview:

~~~bash
npm run media:map-recovered
~~~

The command scans each product folder's immediate files, reports supported image counts and byte sizes, identifies oversized images, unsupported files, nested directories and filesystem errors, then compares folder titles against the local MySQL catalogue.

Title matching is deliberately conservative. It applies Unicode compatibility normalization, case folding, underscore-to-space conversion, dash normalization and whitespace collapsing. It does not remove punctuation, use fuzzy matching, infer a product from a partial title or generate a product slug from the folder name.

This matters for Etsy imports: the catalogue import creates a slug with a stable hash derived from listing data, so a title-only slugification cannot reproduce the stored product slug. The mapping preview looks up the actual database product and only labels a row as a `unique_etsy_draft_candidate` when one normalized title candidate exists, its source provider is Etsy, and its status is still draft.

Other outcomes remain explicit for owner review: unmatched titles, ambiguous MySQL title matches, duplicate recovered folder titles, non-Etsy title matches and non-draft Etsy products. Every row has `manualReviewRequired=true`; a candidate is not an approved mapping.

The preview is read-only. It does not read image bytes, calculate content hashes, rename or copy files, write a mapping manifest, change MySQL or publish products. Hidden macOS metadata files such as `.DS_Store` and `._*` are ignored. Nested directories are reported rather than traversed. The later staging workflow must validate file signatures and exact product mappings before creating importer-compatible folders.

Keep the recovered originals untouched until the mapping report has been reviewed and a separate staging preview is clean. Never run the existing exact-slug media importer directly against the Etsy title-named recovery folders.

## Match and import into local MySQL

After the Etsy listing CSV has been imported as draft products, run the database-aware preview:

~~~bash
npm run media:import
~~~

The importer matches each folder name to an **exact MySQL product slug**. It does not guess by title, SKU or visual similarity. Every matched product must still be a draft. A missing product, non-draft product, malformed folder, invalid image or missing primary image blocks the entire batch.

The preview reports matched products, valid images, duplicate images, per-folder errors and warnings. It is read-only: no image files are copied and no MySQL media rows are written.

After reviewing the preview and confirming that the files are authorized originals, import them into the private media store and MySQL:

~~~bash
npm run media:import -- --commit --confirm-local-import
~~~

This command is restricted to a local MySQL host and is blocked in production. It revalidates each file, checks that it has not changed since preview, copies it to the configured private `MEDIA_STORAGE_ROOT`, and inserts `product_media` rows. Image keys are deterministic by product and content hash, so retrying the same batch does not create duplicate media records. Existing primary images are preserved; an incoming primary is selected only when the product has no primary image.

Imported records always have `rights_confirmed=false` and empty rights evidence. The importer never grants publication permission, publishes products, changes stock, prices, variants or product descriptions. It generates a conservative draft alt-text suggestion that the owner must review and edit in the product editor before rights approval and publication.

## Owner review and publication

After image intake:
1. Match each product folder to the actual draft product record by exact slug and inspect every photograph.
2. Confirm the owner has the rights and permissions needed for commercial use.
3. Either use the individual upload in the owner product editor or run the database-aware bulk import above. Both store files under the private MEDIA_STORAGE_ROOT and record product-media metadata.
4. Supply descriptive, factual alt text.
5. Record a rights-evidence reference and explicitly confirm rights.
6. Choose the primary image and display order.
7. Preview the product on desktop and mobile before publication.

The public product-media route checks the published product and its rights-confirmed media record before returning an image. The intake folder is never served directly by Next.js.

Do not bulk-import or publish images based solely on filenames. Review the photo-to-product matches, image content, generated alt text and commercial-use permission before confirming rights or publishing.
