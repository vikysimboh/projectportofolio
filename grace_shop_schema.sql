-- Skema database Grace Shop (MySQL 8.0)
-- Dibuat dari data aplikasi yang sebenarnya (data/store.json) + tabel users untuk login ber-role.
-- Cara memakai: mysql -h 127.0.0.1 -u grace_app -p grace_shop < grace_shop_schema.sql

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(20) NOT NULL,
  name VARCHAR(60) NOT NULL,
  category VARCHAR(40) NOT NULL,
  emoji VARCHAR(12) NOT NULL DEFAULT '',
  price DECIMAL(12,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(40) NOT NULL,
  customer VARCHAR(100) NOT NULL DEFAULT 'Pelanggan umum',
  date DATETIME NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  payment ENUM('Tunai','QRIS','Transfer','Kartu debit') NOT NULL,
  status ENUM('Selesai','Dibatalkan') NOT NULL DEFAULT 'Selesai',
  PRIMARY KEY (id),
  INDEX idx_transactions_date (date),
  INDEX idx_transactions_status (status),
  INDEX idx_transactions_status_date_total (status, date, total),
  INDEX idx_transactions_status_date_payment_total (status, date, payment, total)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transaction_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  transaction_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(20) NOT NULL,
  name VARCHAR(60) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  qty INT NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_items_transaction (transaction_id),
  INDEX idx_items_product (product_id),
  CONSTRAINT fk_items_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role ENUM('admin','kasir') NOT NULL DEFAULT 'kasir',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
