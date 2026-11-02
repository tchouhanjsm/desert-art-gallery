CREATE TABLE IF NOT EXISTS product_categories (
  id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY product_categories_slug_uq (slug),
  KEY product_categories_active_order_idx (is_active, sort_order, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL,
  legacy_id CHAR(36) NULL,
  title VARCHAR(240) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  short_description VARCHAR(240) NOT NULL DEFAULT '',
  description TEXT NULL,
  product_type VARCHAR(100) NOT NULL DEFAULT '',
  materials JSON NULL,
  sizes JSON NULL,
  measurements JSON NULL,
  condition_notes TEXT NULL,
  provenance TEXT NULL,
  craft_story TEXT NULL,
  currency CHAR(3) NOT NULL,
  price_minor BIGINT UNSIGNED NOT NULL,
  compare_at_price_minor BIGINT UNSIGNED NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  is_one_of_a_kind BOOLEAN NOT NULL DEFAULT FALSE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  seo_title VARCHAR(255) NOT NULL DEFAULT '',
  seo_description VARCHAR(500) NOT NULL DEFAULT '',
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY products_slug_uq (slug),
  UNIQUE KEY products_legacy_id_uq (legacy_id),
  KEY products_status_created_idx (status, created_at),
  KEY products_featured_status_idx (featured, status),
  CONSTRAINT products_currency_check CHECK (currency REGEXP '^[A-Z]{3}$'),
  CONSTRAINT products_status_check CHECK (status IN ('draft','published','archived')),
  CONSTRAINT products_price_compare_check CHECK (compare_at_price_minor IS NULL OR compare_at_price_minor >= price_minor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS product_category_links (
  product_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  PRIMARY KEY (product_id, category_id),
  KEY product_category_links_category_idx (category_id, product_id),
  CONSTRAINT product_category_links_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT product_category_links_category_fk FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS product_variants (
  id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  sku VARCHAR(100) NULL,
  label VARCHAR(180) NOT NULL,
  attributes JSON NOT NULL,
  price_minor BIGINT UNSIGNED NULL,
  currency CHAR(3) NOT NULL,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY product_variants_sku_uq (sku),
  KEY product_variants_product_order_idx (product_id, is_active, sort_order),
  CONSTRAINT product_variants_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT product_variants_currency_check CHECK (currency REGEXP '^[A-Z]{3}$'),
  CONSTRAINT product_variants_stock_check CHECK (stock_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS product_media (
  id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  alt_text VARCHAR(300) NOT NULL,
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  rights_evidence VARCHAR(1000) NOT NULL DEFAULT '',
  mime_type VARCHAR(40) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  position INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY product_media_storage_key_uq (storage_key),
  KEY product_media_product_order_idx (product_id, position, id),
  CONSTRAINT product_media_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT product_media_rights_check CHECK (rights_confirmed = FALSE OR (CHAR_LENGTH(TRIM(alt_text)) > 0 AND CHAR_LENGTH(TRIM(rights_evidence)) > 0)),
  CONSTRAINT product_media_mime_check CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  CONSTRAINT product_media_size_check CHECK (byte_size > 0 AND byte_size <= 12582912),
  CONSTRAINT product_media_dimensions_check CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_movements (
  id CHAR(36) NOT NULL,
  variant_id CHAR(36) NOT NULL,
  quantity_delta INT NOT NULL,
  reason VARCHAR(160) NOT NULL,
  reference_key VARCHAR(180) NOT NULL,
  actor_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY inventory_movements_reference_uq (reference_key),
  KEY inventory_movements_variant_created_idx (variant_id, created_at),
  CONSTRAINT inventory_movements_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movement_nonzero_check CHECK (quantity_delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id CHAR(36) NOT NULL,
  customer_reference VARCHAR(180) NOT NULL,
  idempotency_key VARCHAR(180) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'reserved',
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY inventory_reservations_idempotency_uq (idempotency_key),
  KEY inventory_reservations_expiry_idx (status, expires_at),
  CONSTRAINT inventory_reservations_status_check CHECK (status IN ('reserved','released','expired','consumed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_reservation_items (
  id CHAR(36) NOT NULL,
  reservation_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY inventory_reservation_items_pair_uq (reservation_id, variant_id),
  KEY inventory_reservation_items_variant_idx (variant_id),
  CONSTRAINT reservation_items_reservation_fk FOREIGN KEY (reservation_id) REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  CONSTRAINT reservation_items_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT reservation_items_quantity_check CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE collection_product_links
  ADD CONSTRAINT collection_product_links_product_slug_fk
  FOREIGN KEY (product_slug) REFERENCES products(slug)
  ON DELETE CASCADE;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(160) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'owner',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY admin_users_email_uq (email),
  KEY admin_users_active_role_idx (is_active, role),
  CONSTRAINT admin_users_role_check CHECK (role IN ('owner','admin')),
  CONSTRAINT admin_users_failed_login_count_check CHECK (failed_login_count BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS admin_sessions (
  id CHAR(36) NOT NULL,
  admin_user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY admin_sessions_token_hash_uq (token_hash),
  KEY admin_sessions_user_expiry_idx (admin_user_id, expires_at),
  CONSTRAINT admin_sessions_user_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
