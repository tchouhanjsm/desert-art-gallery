CREATE TABLE IF NOT EXISTS site_content (
  id CHAR(36) NOT NULL,
  content_key VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  body JSON NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY site_content_key_uq (content_key),
  KEY site_content_published_idx (is_published, content_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS collections (
  id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  hero_image_path VARCHAR(512) NULL,
  hero_image_alt VARCHAR(300) NOT NULL DEFAULT '',
  hero_image_rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  hero_image_rights_evidence VARCHAR(1000) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY collections_slug_uq (slug),
  KEY collections_public_order_idx (is_published, sort_order, name),
  CONSTRAINT collections_hero_rights_evidence_check
    CHECK (hero_image_rights_confirmed = FALSE OR (CHAR_LENGTH(TRIM(hero_image_rights_evidence)) > 0 AND CHAR_LENGTH(TRIM(hero_image_alt)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS artisan_profiles (
  id CHAR(36) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  role_title VARCHAR(120) NOT NULL DEFAULT '',
  short_bio VARCHAR(360) NOT NULL DEFAULT '',
  biography TEXT NOT NULL,
  craft_specialties JSON NOT NULL,
  years_experience SMALLINT NULL,
  portrait_path VARCHAR(512) NULL,
  portrait_alt_text VARCHAR(300) NOT NULL DEFAULT '',
  portrait_rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  portrait_rights_evidence VARCHAR(1000) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY artisan_profiles_public_order_idx (is_published, sort_order, full_name),
  CONSTRAINT artisan_portrait_rights_evidence_check
    CHECK (portrait_rights_confirmed = FALSE OR (CHAR_LENGTH(TRIM(portrait_rights_evidence)) > 0 AND CHAR_LENGTH(TRIM(portrait_alt_text)) > 0)),
  CONSTRAINT artisan_experience_range_check
    CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS journal_posts (
  id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  excerpt VARCHAR(500) NOT NULL,
  content_markdown TEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Stories',
  cover_image_path VARCHAR(512) NULL,
  cover_image_alt VARCHAR(300) NOT NULL DEFAULT '',
  cover_image_rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  cover_image_rights_evidence VARCHAR(1000) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  author_id CHAR(36) NULL,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY journal_posts_slug_uq (slug),
  KEY journal_posts_publication_idx (status, published_at),
  KEY journal_posts_updated_idx (updated_at),
  CONSTRAINT journal_status_check CHECK (status IN ('draft','published','archived')),
  CONSTRAINT journal_cover_rights_evidence_check
    CHECK (cover_image_rights_confirmed = FALSE OR (CHAR_LENGTH(TRIM(cover_image_rights_evidence)) > 0 AND CHAR_LENGTH(TRIM(cover_image_alt)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
