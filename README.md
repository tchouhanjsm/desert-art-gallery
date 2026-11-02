# Desert Art Gallery

An editorial commerce experience for rare heritage textiles and handcrafted pieces from Jaisalmer, Rajasthan.

## Local development

```bash
npm install
npm run dev
```

Do not publish guessed prices, measurements, stock, artisan biographies, shipping promises, reviews or policy terms. Seed product records are inquiry-only examples; replace them with verified merchant data before sale. Obtain and store authorized original product images instead of hotlinking assets.

See `data/product-import-template.csv` and `docs/production-readiness.md` for catalogue and launch requirements.

## Owner CMS and MySQL

The MySQL/Drizzle editorial cutover and one-time import are documented in [MySQL Editorial CMS Cutover — Phase 4](docs/MYSQL-EDITORIAL-CUTOVER-PHASE-4.md).

The catalogue/inventory schema is being introduced as a separate staged migration. The existing Supabase commerce adapter remains the active fallback until a local MySQL cutover is explicitly accepted. See [MySQL Catalogue Migration — Phase 5](docs/MYSQL-CATALOGUE-MIGRATION-PHASE-5.md).
