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

## Owner review and publication

After image intake:
1. Match each product folder to the actual product record and inspect every photograph.
2. Confirm the owner has the rights and permissions needed for commercial use.
3. Upload the selected originals through the owner product/media workflow. The app stores files under the private MEDIA_STORAGE_ROOT and records product-media metadata.
4. Supply descriptive, factual alt text.
5. Record a rights-evidence reference and explicitly confirm rights.
6. Choose the primary image and display order.
7. Preview the product on desktop and mobile before publication.

The public product-media route checks the published product and its rights-confirmed media record before returning an image. The intake folder is never served directly by Next.js.

Do not bulk-import or publish images based solely on filenames. A future bulk association tool can be added after the owner's actual folder contents and product catalogue have been reviewed.
