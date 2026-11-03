-- Phase 7: MySQL order drafts, address/price snapshots and fulfilment.
-- Legacy reservation rows stay nullable; checkout rejects reservations without a complete snapshot.
ALTER TABLE inventory_reservation_items
  ADD COLUMN product_id_snapshot CHAR(36) NULL,
  ADD COLUMN product_title_snapshot VARCHAR(240) NULL,
  ADD COLUMN product_sku_snapshot VARCHAR(100) NULL,
  ADD COLUMN variant_label_snapshot VARCHAR(180) NULL,
  ADD COLUMN selected_options_snapshot JSON NULL,
  ADD COLUMN unit_price_minor_snapshot BIGINT UNSIGNED NULL,
  ADD COLUMN currency_snapshot CHAR(3) NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS shipping_zones (
 id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, country_codes JSON NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), UNIQUE KEY shipping_zones_name_uq (name), KEY shipping_zones_active_idx (is_active),
 CONSTRAINT shipping_zones_countries_check CHECK (JSON_TYPE(country_codes) = 'ARRAY' AND JSON_LENGTH(country_codes) BETWEEN 1 AND 50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS shipping_rates (
 id CHAR(36) NOT NULL, zone_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL,
 currency CHAR(3) NOT NULL, amount_minor BIGINT UNSIGNED NOT NULL,
 min_delivery_days SMALLINT UNSIGNED NULL, max_delivery_days SMALLINT UNSIGNED NULL,
 duties_disclosure VARCHAR(2000) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), KEY shipping_rates_zone_active_idx (zone_id, is_active, currency),
 CONSTRAINT shipping_rates_zone_fk FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE RESTRICT,
 CONSTRAINT shipping_rates_currency_check CHECK (currency REGEXP '^[A-Z]{3}$'),
 CONSTRAINT shipping_rates_duties_check CHECK (CHAR_LENGTH(TRIM(duties_disclosure)) BETWEEN 1 AND 2000),
 CONSTRAINT shipping_rates_delivery_days_check CHECK (
  (min_delivery_days IS NULL AND max_delivery_days IS NULL) OR
  (min_delivery_days IS NOT NULL AND max_delivery_days IS NOT NULL AND min_delivery_days <= max_delivery_days AND max_delivery_days <= 365)
 )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS checkout_tax_rules (
 id CHAR(36) NOT NULL, country_code CHAR(2) NOT NULL, currency CHAR(3) NOT NULL,
 tax_name VARCHAR(120) NOT NULL, rate_basis_points INT UNSIGNED NOT NULL,
 taxable_shipping BOOLEAN NOT NULL DEFAULT FALSE, disclosure VARCHAR(2000) NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), UNIQUE KEY checkout_tax_rules_destination_name_uq (country_code, currency, tax_name),
 KEY checkout_tax_rules_destination_idx (country_code, currency, is_active),
 CONSTRAINT checkout_tax_rules_country_check CHECK (country_code REGEXP '^[A-Z]{2}$'),
 CONSTRAINT checkout_tax_rules_currency_check CHECK (currency REGEXP '^[A-Z]{3}$'),
 CONSTRAINT checkout_tax_rules_rate_check CHECK (rate_basis_points BETWEEN 0 AND 10000),
 CONSTRAINT checkout_tax_rules_disclosure_check CHECK (CHAR_LENGTH(TRIM(disclosure)) BETWEEN 1 AND 2000),
 CONSTRAINT checkout_tax_rules_name_check CHECK (CHAR_LENGTH(TRIM(tax_name)) BETWEEN 1 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS orders (
 id CHAR(36) NOT NULL, order_number VARCHAR(32) NOT NULL, customer_user_id CHAR(36) NOT NULL,
 email VARCHAR(255) NOT NULL, reservation_id CHAR(36) NOT NULL,
 checkout_idempotency_key CHAR(36) NOT NULL, checkout_request_hash CHAR(64) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'draft', currency CHAR(3) NOT NULL,
 subtotal_minor BIGINT UNSIGNED NOT NULL, shipping_minor BIGINT UNSIGNED NOT NULL,
 tax_minor BIGINT UNSIGNED NOT NULL, discount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
 total_minor BIGINT UNSIGNED NOT NULL, shipping_address JSON NOT NULL,
 customer_note VARCHAR(1000) NULL, expires_at DATETIME(3) NOT NULL, shipping_rate_id CHAR(36) NULL,
 shipping_zone_name VARCHAR(120) NOT NULL, shipping_rate_name VARCHAR(120) NOT NULL,
 shipping_delivery_min_days SMALLINT UNSIGNED NULL, shipping_delivery_max_days SMALLINT UNSIGNED NULL,
 duties_disclosure VARCHAR(2000) NOT NULL, tax_breakdown JSON NOT NULL, tax_disclosure VARCHAR(10000) NOT NULL,
 tracking_carrier VARCHAR(100) NULL, tracking_number VARCHAR(160) NULL, tracking_url VARCHAR(1000) NULL,
 shipped_at DATETIME(3) NULL, delivered_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), UNIQUE KEY orders_number_uq (order_number),
 UNIQUE KEY orders_reservation_uq (reservation_id),
 UNIQUE KEY orders_customer_checkout_key_uq (customer_user_id, checkout_idempotency_key),
 KEY orders_customer_created_idx (customer_user_id, created_at), KEY orders_status_created_idx (status, created_at),
 KEY orders_expiry_idx (status, expires_at),
 CONSTRAINT orders_customer_fk FOREIGN KEY (customer_user_id) REFERENCES customer_users(id) ON DELETE RESTRICT,
 CONSTRAINT orders_reservation_fk FOREIGN KEY (reservation_id) REFERENCES inventory_reservations(id) ON DELETE RESTRICT,
 CONSTRAINT orders_shipping_rate_fk FOREIGN KEY (shipping_rate_id) REFERENCES shipping_rates(id) ON DELETE SET NULL,
 CONSTRAINT orders_currency_check CHECK (currency REGEXP '^[A-Z]{3}$'),
 CONSTRAINT orders_status_check CHECK (status IN ('draft','pending_payment','paid','processing','shipped','delivered','cancelled','expired','refunded')),
 CONSTRAINT orders_checkout_hash_check CHECK (checkout_request_hash REGEXP '^[a-f0-9]{64}$'),
 CONSTRAINT orders_amounts_check CHECK (total_minor = subtotal_minor + shipping_minor + tax_minor - discount_minor),
 CONSTRAINT orders_delivery_days_check CHECK (
  (shipping_delivery_min_days IS NULL AND shipping_delivery_max_days IS NULL) OR
  (shipping_delivery_min_days IS NOT NULL AND shipping_delivery_max_days IS NOT NULL AND shipping_delivery_min_days <= shipping_delivery_max_days AND shipping_delivery_max_days <= 365)
 )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS order_items (
 id CHAR(36) NOT NULL, order_id CHAR(36) NOT NULL, product_id_snapshot CHAR(36) NOT NULL,
 variant_id_snapshot CHAR(36) NOT NULL, product_title VARCHAR(240) NOT NULL,
 product_sku VARCHAR(100) NULL, variant_label VARCHAR(180) NOT NULL,
 quantity INT UNSIGNED NOT NULL, unit_price_minor BIGINT UNSIGNED NOT NULL,
 line_total_minor BIGINT UNSIGNED NOT NULL, selected_options JSON NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), KEY order_items_order_idx (order_id, created_at),
 CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
 CONSTRAINT order_items_quantity_check CHECK (quantity BETWEEN 1 AND 100),
 CONSTRAINT order_items_total_check CHECK (line_total_minor = quantity * unit_price_minor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS order_events (
 id CHAR(36) NOT NULL, order_id CHAR(36) NOT NULL, actor_type VARCHAR(16) NOT NULL,
 actor_id CHAR(36) NULL, event_type VARCHAR(40) NOT NULL, from_status VARCHAR(24) NULL,
 to_status VARCHAR(24) NULL, note VARCHAR(1000) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), KEY order_events_order_created_idx (order_id, created_at),
 CONSTRAINT order_events_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
 CONSTRAINT order_events_actor_type_check CHECK (actor_type IN ('customer','admin','system')),
 CONSTRAINT order_events_status_check CHECK (
  (from_status IS NULL OR from_status IN ('draft','pending_payment','paid','processing','shipped','delivered','cancelled','expired','refunded')) AND
  (to_status IS NULL OR to_status IN ('draft','pending_payment','paid','processing','shipped','delivered','cancelled','expired','refunded'))
 )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
