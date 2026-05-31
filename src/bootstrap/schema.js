import { getPool } from "../db.js";

const STATEMENTS = [
  `ALTER TABLE users MODIFY COLUMN role ENUM('owner','admin','client') NOT NULL DEFAULT 'owner'`,
  `ALTER TABLE listings
    MODIFY COLUMN property_type ENUM('apartment','house','land','office','shop') NOT NULL`,
  `ALTER TABLE listings
    MODIFY COLUMN status ENUM('Draft','Pending Payment','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Submitted'`,
  `ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_type ENUM('connection_fee','listing_submission') NOT NULL DEFAULT 'connection_fee' AFTER user_id`,
  `ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP NULL DEFAULT NULL AFTER provider_ref`,
  `ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`,
  `CREATE TABLE IF NOT EXISTS message_threads (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    thread_type ENUM('owner_contact','support') NOT NULL,
    status ENUM('open','closed') NOT NULL DEFAULT 'open',
    subject VARCHAR(255) DEFAULT NULL,
    listing_id BIGINT UNSIGNED DEFAULT NULL,
    client_user_id BIGINT UNSIGNED DEFAULT NULL,
    owner_user_id BIGINT UNSIGNED DEFAULT NULL,
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS message_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    thread_id BIGINT UNSIGNED NOT NULL,
    sender_user_id BIGINT UNSIGNED DEFAULT NULL,
    sender_role ENUM('client','owner','admin','system') NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS push_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    expo_push_token VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) DEFAULT NULL,
    platform ENUM('ios','android','web','unknown') NOT NULL DEFAULT 'unknown',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_push_token (expo_push_token),
    UNIQUE KEY uniq_user_device (user_id, device_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
];

export async function ensureAppSchema() {
  const pool = getPool();
  for (const statement of STATEMENTS) {
    await pool.execute(statement);
  }
}
