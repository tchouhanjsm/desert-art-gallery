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
