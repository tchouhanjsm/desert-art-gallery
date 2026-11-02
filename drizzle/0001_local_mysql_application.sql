CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  role VARCHAR(16) NOT NULL DEFAULT 'customer',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  email_verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY users_email_uq (email),
  KEY users_role_status_idx (role, status),
  CONSTRAINT users_role_check CHECK (role IN ('customer','staff','admin','owner')),
  CONSTRAINT users_status_check CHECK (status IN ('active','disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE user_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY user_sessions_token_hash_uq (token_hash),
  KEY user_sessions_user_expiry_idx (user_id, expires_at),
  CONSTRAINT user_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE password_reset_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY password_reset_tokens_hash_uq (token_hash),
  KEY password_reset_tokens_user_expiry_idx (user_id, expires_at),
  CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY categories_slug_uq (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  category_id CHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  short_description VARCHAR(500) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  sku VARCHAR(80) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  price_minor BIGINT NULL,
  compare_at_price_minor BIGINT NULL,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  is_one_of_a_kind BOOLEAN NOT NULL DEFAULT FALSE,
  materials JSON NOT NULL,
  sizes JSON NOT NULL,
  measurements JSON NOT NULL,
  condition_notes TEXT NOT NULL,
  provenance TEXT NOT NULL,
  craft_story TEXT NOT NULL,
  seo_title VARCHAR(180) NULL,
  seo_description VARCHAR(320) NULL,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY products_slug_uq (slug),
  UNIQUE KEY products_sku_uq (sku),
  KEY products_status_published_idx (status, published_at),
  KEY products_category_idx (category_id),
  KEY products_updated_idx (updated_at),
  CONSTRAINT products_category_fk FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT products_status_check CHECK (status IN ('draft','active','archived')),
  CONSTRAINT products_price_check CHECK (price_minor IS NULL OR price_minor >= 0),
  CONSTRAINT products_compare_price_check CHECK (compare_at_price_minor IS NULL OR price_minor IS NULL OR compare_at_price_minor >= price_minor),
  CONSTRAINT products_quantity_check CHECK (quantity_on_hand >= 0),
  CONSTRAINT products_publish_price_check CHECK (status <> 'active' OR price_minor IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE product_images (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  alt_text VARCHAR(300) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  rights_evidence VARCHAR(1000) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY product_images_storage_path_uq (storage_path),
  KEY product_images_product_order_idx (product_id, sort_order),
  KEY product_images_public_idx (product_id, rights_confirmed),
  CONSTRAINT product_images_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT product_image_rights_check CHECK (rights_confirmed = FALSE OR (CHAR_LENGTH(TRIM(rights_evidence)) > 0 AND CHAR_LENGTH(TRIM(alt_text)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE collection_product_links
  ADD COLUMN product_id CHAR(36) NULL AFTER collection_id,
  ADD KEY collection_product_links_product_id_idx (product_id),
  ADD CONSTRAINT collection_product_links_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE TABLE product_collection_links (
  id CHAR(36) NOT NULL PRIMARY KEY,
  collection_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY product_collection_pair_uq (collection_id, product_id),
  KEY product_collection_product_idx (product_id),
  CONSTRAINT product_collection_collection_fk FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  CONSTRAINT product_collection_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE product_variants (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  sku VARCHAR(80) NULL,
  label VARCHAR(120) NOT NULL,
  attributes JSON NOT NULL,
  price_override_minor BIGINT NULL,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY product_variants_sku_uq (sku),
  UNIQUE KEY product_variants_product_label_uq (product_id, label),
  KEY product_variants_product_status_idx (product_id, status, sort_order),
  CONSTRAINT product_variants_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT product_variant_status_check CHECK (status IN ('draft','active','archived')),
  CONSTRAINT product_variant_quantity_check CHECK (quantity_on_hand >= 0),
  CONSTRAINT product_variant_attributes_check CHECK (JSON_TYPE(attributes) = 'OBJECT' AND JSON_LENGTH(attributes) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE inventory_movements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NULL,
  quantity_delta INT NOT NULL,
  reason VARCHAR(40) NOT NULL,
  reference VARCHAR(160) NULL,
  actor_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY inventory_movements_product_date_idx (product_id, created_at),
  KEY inventory_movements_variant_date_idx (variant_id, created_at),
  CONSTRAINT inventory_movements_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  CONSTRAINT inventory_movements_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT inventory_movements_delta_check CHECK (quantity_delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE inventory_reservations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'reserved',
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY inventory_reservations_user_key_uq (user_id, idempotency_key),
  KEY inventory_reservations_status_expiry_idx (status, expires_at),
  CONSTRAINT inventory_reservations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT inventory_reservations_status_check CHECK (status IN ('reserved','released','expired')),
  CONSTRAINT inventory_reservations_hash_check CHECK (request_hash REGEXP '^[a-f0-9]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE inventory_reservation_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reservation_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NULL,
  product_title VARCHAR(180) NOT NULL,
  product_sku VARCHAR(80) NULL,
  variant_label VARCHAR(120) NULL,
  selected_options JSON NOT NULL,
  quantity INT NOT NULL,
  unit_price_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY reservation_product_variant_uq (reservation_id, product_id, variant_id),
  KEY reservation_stock_lookup_idx (product_id, variant_id, reservation_id),
  CONSTRAINT reservation_items_reservation_fk FOREIGN KEY (reservation_id) REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  CONSTRAINT reservation_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT reservation_items_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT reservation_items_quantity_check CHECK (quantity BETWEEN 1 AND 99),
  CONSTRAINT reservation_items_price_check CHECK (unit_price_minor >= 0),
  CONSTRAINT reservation_items_currency_check CHECK (currency REGEXP '^[A-Z]{3}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE addresses (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  recipient_name VARCHAR(160) NOT NULL,
  address_line_1 VARCHAR(240) NOT NULL,
  address_line_2 VARCHAR(240) NULL,
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) NULL,
  postal_code VARCHAR(24) NOT NULL,
  country_code CHAR(2) NOT NULL,
  phone VARCHAR(40) NULL,
  is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY addresses_user_default_idx (user_id, is_default_shipping),
  CONSTRAINT addresses_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL,
  user_id CHAR(36) NULL,
  email VARCHAR(320) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  subtotal_minor BIGINT NOT NULL,
  shipping_minor BIGINT NOT NULL DEFAULT 0,
  tax_minor BIGINT NOT NULL DEFAULT 0,
  discount_minor BIGINT NOT NULL DEFAULT 0,
  total_minor BIGINT NOT NULL,
  shipping_address JSON NOT NULL,
  billing_address JSON NULL,
  customer_note TEXT NULL,
  reservation_id CHAR(36) NULL,
  checkout_idempotency_key CHAR(36) NULL,
  checkout_request_hash CHAR(64) NULL,
  expires_at DATETIME(3) NULL,
  shipping_rate_id CHAR(36) NULL,
  shipping_zone_name VARCHAR(120) NULL,
  shipping_rate_name VARCHAR(160) NULL,
  shipping_delivery_min_days INT NULL,
  shipping_delivery_max_days INT NULL,
  duties_disclosure TEXT NULL,
  tax_breakdown JSON NOT NULL,
  tax_disclosure TEXT NOT NULL,
  tracking_carrier VARCHAR(120) NULL,
  tracking_number VARCHAR(160) NULL,
  tracking_url VARCHAR(1000) NULL,
  placed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  shipped_at DATETIME(3) NULL,
  delivered_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY orders_number_uq (order_number),
  UNIQUE KEY orders_reservation_uq (reservation_id),
  UNIQUE KEY orders_user_idempotency_uq (user_id, checkout_idempotency_key),
  KEY orders_user_date_idx (user_id, created_at),
  KEY orders_status_date_idx (status, created_at),
  CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT orders_reservation_fk FOREIGN KEY (reservation_id) REFERENCES inventory_reservations(id) ON DELETE SET NULL,
  CONSTRAINT orders_status_check CHECK (status IN ('draft','pending_payment','paid','processing','shipped','delivered','cancelled','expired','refunded')),
  CONSTRAINT orders_amounts_check CHECK (subtotal_minor >= 0 AND shipping_minor >= 0 AND tax_minor >= 0 AND discount_minor >= 0 AND total_minor >= 0),
  CONSTRAINT orders_total_check CHECK (total_minor = subtotal_minor + shipping_minor + tax_minor - discount_minor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE order_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  variant_id CHAR(36) NULL,
  product_title VARCHAR(180) NOT NULL,
  product_sku VARCHAR(80) NULL,
  variant_label VARCHAR(120) NULL,
  quantity INT NOT NULL,
  unit_price_minor BIGINT NOT NULL,
  line_total_minor BIGINT NOT NULL,
  selected_options JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY order_items_order_idx (order_id),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT order_items_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_amount_check CHECK (unit_price_minor >= 0 AND line_total_minor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE cart_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NULL,
  quantity INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY cart_items_user_idx (user_id),
  CONSTRAINT cart_items_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT cart_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT cart_items_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT cart_items_quantity_check CHECK (quantity BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE wishlist_items (
  user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT wishlist_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT wishlist_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE discount_codes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  discount_type VARCHAR(16) NOT NULL,
  discount_value INT NOT NULL,
  currency CHAR(3) NULL,
  starts_at DATETIME(3) NULL,
  ends_at DATETIME(3) NULL,
  usage_limit INT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY discount_codes_code_uq (code),
  CONSTRAINT discount_type_check CHECK (discount_type IN ('percentage','fixed')),
  CONSTRAINT discount_value_check CHECK (discount_value > 0),
  CONSTRAINT discount_usage_check CHECK (usage_count >= 0 AND (usage_limit IS NULL OR usage_limit > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE shipping_zones (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  country_codes JSON NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE shipping_rates (
  id CHAR(36) NOT NULL PRIMARY KEY,
  zone_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL,
  min_delivery_days INT NULL,
  max_delivery_days INT NULL,
  duties_disclosure TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY shipping_rates_zone_active_idx (zone_id, is_active),
  CONSTRAINT shipping_rates_zone_fk FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE CASCADE,
  CONSTRAINT shipping_rate_amount_check CHECK (amount_minor >= 0),
  CONSTRAINT shipping_rate_delivery_check CHECK (max_delivery_days IS NULL OR min_delivery_days IS NULL OR max_delivery_days >= min_delivery_days)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE checkout_tax_rules (
  id CHAR(36) NOT NULL PRIMARY KEY,
  country_code CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  tax_name VARCHAR(120) NOT NULL,
  rate_basis_points INT NOT NULL,
  taxable_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  disclosure VARCHAR(2000) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY checkout_tax_rule_destination_uq (country_code, currency, tax_name),
  KEY checkout_tax_rules_destination_idx (country_code, currency, is_active),
  CONSTRAINT checkout_tax_rule_rate_check CHECK (rate_basis_points BETWEEN 0 AND 10000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE customer_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  product_id CHAR(36) NULL,
  customer_display_name VARCHAR(160) NOT NULL,
  rating SMALLINT NOT NULL,
  review_text TEXT NOT NULL,
  moderation_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  source VARCHAR(16) NOT NULL DEFAULT 'website',
  permission_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY customer_reviews_product_status_idx (product_id, moderation_status),
  CONSTRAINT customer_reviews_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT customer_reviews_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT customer_reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT customer_reviews_status_check CHECK (moderation_status IN ('pending','approved','rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE catalogue_import_batches (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_by CHAR(36) NULL,
  row_count INT NOT NULL,
  products_created INT NOT NULL,
  stock_units_added BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT catalogue_import_batches_user_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE newsletter_subscribers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  consent_at DATETIME(3) NOT NULL,
  confirmation_token_hash CHAR(64) NULL,
  unsubscribe_token_hash CHAR(64) NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'website',
  confirmed_at DATETIME(3) NULL,
  unsubscribed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY newsletter_email_uq (email),
  UNIQUE KEY newsletter_unsubscribe_token_uq (unsubscribe_token_hash),
  CONSTRAINT newsletter_status_check CHECK (status IN ('pending','confirmed','unsubscribed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id CHAR(36) NULL,
  action VARCHAR(16) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NULL,
  metadata JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY audit_log_entity_created_idx (entity_type, entity_id, created_at),
  CONSTRAINT audit_log_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE payment_webhook_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  provider VARCHAR(24) NOT NULL,
  provider_event_id VARCHAR(180) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  processed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY payment_webhook_provider_event_uq (provider, provider_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
