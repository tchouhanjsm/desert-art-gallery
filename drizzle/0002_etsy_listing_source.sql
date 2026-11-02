ALTER TABLE products
  ADD COLUMN tags JSON NULL AFTER materials,
  ADD COLUMN source_metadata JSON NULL AFTER seo_description;
--> statement-breakpoint
ALTER TABLE catalogue_import_batches
  DROP CHECK catalogue_import_batches_row_count_check,
  DROP CHECK catalogue_import_batches_products_check,
  ADD CONSTRAINT catalogue_import_batches_row_count_check CHECK (row_count BETWEEN 1 AND 1000),
  ADD CONSTRAINT catalogue_import_batches_products_check CHECK (products_created BETWEEN 1 AND 1000);
