# Desert Art Gallery

**Where Every Textile Tells a Story.**

An editorial commerce experience for rare heritage textiles and handcrafted pieces from Jaisalmer, Rajasthan.

## Project status

This repository was empty when implementation began. The initial milestone establishes a bespoke storefront foundation and a data model for a verified product catalogue. It does not claim to deliver live checkout, payment processing, customer accounts, inventory synchronisation, or a production admin backend until those integrations are configured and tested.

## Design direction

A warm ivory and desert-earth palette, expressive editorial serif typography, restrained sans-serif utility text, generous photography, and clear shopping pathways. The visual system is original to Desert Art Gallery.

## Product truth

Never publish guessed prices, measurements, stock, artisan biographies, shipping promises, reviews, or policy terms. Products must be populated from the merchant's authorized source data. The initial catalogue is intentionally editorial/sample content and must be replaced or marked unpublished until verified.

## Local development

```bash
npm install
npm run dev
```

## Planned production integrations

- Supabase PostgreSQL, Auth, and Storage
- Server-side inventory and order workflows
- Razorpay for eligible India transactions and a supported international processor
- Transactional email provider
- Configurable shipping zones, duties, and tracking
- GA4 with consent-aware analytics

Payment provider credentials and customer data must remain server-side. Never collect or store raw card numbers.

## Import

Use `data/product-import-template.csv` as the starting schema. Review all imported fields, confirm image rights, then publish only verified records.
