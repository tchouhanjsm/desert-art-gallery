CREATE TABLE IF NOT EXISTS customer_users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY customer_users_email_uq (email),
  KEY customer_users_active_idx (is_active),
  CONSTRAINT customer_users_failed_login_count_check CHECK (failed_login_count BETWEEN 0 AND 100),
  CONSTRAINT customer_users_email_check CHECK (email REGEXP '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_sessions (
  id CHAR(36) NOT NULL,
  customer_user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY customer_sessions_token_hash_uq (token_hash),
  KEY customer_sessions_user_expiry_idx (customer_user_id, expires_at),
  CONSTRAINT customer_sessions_user_fk FOREIGN KEY (customer_user_id)
    REFERENCES customer_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_addresses (
  id CHAR(36) NOT NULL,
  customer_user_id CHAR(36) NOT NULL,
  recipient_name VARCHAR(160) NOT NULL,
  address_line_1 VARCHAR(240) NOT NULL,
  address_line_2 VARCHAR(240) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) NOT NULL DEFAULT '',
  postal_code VARCHAR(24) NOT NULL,
  country_code CHAR(2) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY customer_addresses_customer_default_idx (customer_user_id, is_default_shipping, created_at),
  CONSTRAINT customer_addresses_customer_fk FOREIGN KEY (customer_user_id)
    REFERENCES customer_users(id) ON DELETE CASCADE,
  CONSTRAINT customer_addresses_country_check CHECK (country_code REGEXP '^[A-Z]{2}$'),
  CONSTRAINT customer_addresses_required_check CHECK (
    CHAR_LENGTH(TRIM(recipient_name)) > 0 AND
    CHAR_LENGTH(TRIM(address_line_1)) > 0 AND
    CHAR_LENGTH(TRIM(city)) > 0 AND
    CHAR_LENGTH(TRIM(postal_code)) > 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_cart_items (
  id CHAR(36) NOT NULL,
  customer_user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NULL,
  line_key VARCHAR(240) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY customer_cart_items_line_uq (customer_user_id, line_key),
  KEY customer_cart_items_product_idx (product_id),
  KEY customer_cart_items_variant_idx (variant_id),
  CONSTRAINT customer_cart_items_customer_fk FOREIGN KEY (customer_user_id)
    REFERENCES customer_users(id) ON DELETE CASCADE,
  CONSTRAINT customer_cart_items_product_fk FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT customer_cart_items_variant_fk FOREIGN KEY (variant_id)
    REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT customer_cart_items_quantity_check CHECK (quantity BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_wishlist_items (
  id CHAR(36) NOT NULL,
  customer_user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY customer_wishlist_items_product_uq (customer_user_id, product_id),
  KEY customer_wishlist_items_created_idx (customer_user_id, created_at),
  CONSTRAINT customer_wishlist_items_customer_fk FOREIGN KEY (customer_user_id)
    REFERENCES customer_users(id) ON DELETE CASCADE,
  CONSTRAINT customer_wishlist_items_product_fk FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
