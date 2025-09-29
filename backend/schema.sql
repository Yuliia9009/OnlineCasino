-- ===== OnlineCasino MySQL schema (aligned with Prisma models) =====

-- 1) Database
CREATE DATABASE IF NOT EXISTS onlinecasino
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE onlinecasino;

-- 2) ENUM helpers (note: Prisma maps enums per-table; here we inline as native ENUMs)

/* ======================= MODELS ======================= */

-- players
DROP TABLE IF EXISTS players;
CREATE TABLE players (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  address_checksum     CHAR(42)        NOT NULL,
  address_norm         CHAR(42)        NULL,
  chain_id             BIGINT UNSIGNED NOT NULL DEFAULT 31337,
  total_spins          BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_deposited_wei  VARCHAR(78)     NOT NULL DEFAULT '0',
  total_bet_wei        VARCHAR(78)     NOT NULL DEFAULT '0',
  total_payout_wei     VARCHAR(78)     NOT NULL DEFAULT '0',
  total_withdrawn_wei  VARCHAR(78)     NOT NULL DEFAULT '0',
  net_wei              VARCHAR(78)     NOT NULL DEFAULT '0',
  created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_addr_chain (address_norm, chain_id),
  KEY idx_player_updated (updated_at)
) ENGINE=InnoDB;

-- deposits
DROP TABLE IF EXISTS deposits;
CREATE TABLE deposits (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tx_hash              CHAR(66)        NOT NULL,
  player_address       CHAR(42)        NOT NULL,
  player_address_norm  CHAR(42)        NULL,
  chain_id             BIGINT UNSIGNED NOT NULL,
  amount_wei           VARCHAR(78)     NOT NULL,
  block_number         BIGINT UNSIGNED NOT NULL,
  timestamp_utc        DATETIME        NOT NULL,
  status               ENUM('ok','failed') NOT NULL DEFAULT 'ok',
  created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deposit_tx (tx_hash, chain_id),
  KEY idx_deposit_block (block_number),
  KEY idx_deposit_player (player_address_norm, chain_id, timestamp_utc)
) ENGINE=InnoDB;

-- spins
DROP TABLE IF EXISTS spins;
CREATE TABLE spins (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tx_hash              CHAR(66)        NOT NULL,
  player_address       CHAR(42)        NOT NULL,
  player_address_norm  CHAR(42)        NULL,
  chain_id             BIGINT UNSIGNED NOT NULL,
  bet_wei              VARCHAR(78)     NOT NULL,
  payout_wei           VARCHAR(78)     NOT NULL,
  reel_1               INT             NOT NULL,
  reel_2               INT             NOT NULL,
  reel_3               INT             NOT NULL,
  rnd_seed             VARCHAR(78)     NULL,
  block_number         BIGINT UNSIGNED NOT NULL,
  timestamp_utc        DATETIME        NOT NULL,
  created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_spin_tx (tx_hash, chain_id),
  KEY idx_spin_block (block_number),
  KEY idx_spin_player (player_address_norm, chain_id, timestamp_utc)
) ENGINE=InnoDB;

-- withdrawals
DROP TABLE IF EXISTS withdrawals;
CREATE TABLE withdrawals (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tx_hash              CHAR(66)        NOT NULL,
  player_address       CHAR(42)        NOT NULL,
  player_address_norm  CHAR(42)        NULL,
  chain_id             BIGINT UNSIGNED NOT NULL,
  amount_wei           VARCHAR(78)     NOT NULL,
  block_number         BIGINT UNSIGNED NOT NULL,
  timestamp_utc        DATETIME        NOT NULL,
  status               ENUM('ok','failed','pending') NOT NULL DEFAULT 'ok',
  created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_withdraw_tx (tx_hash, chain_id),
  KEY idx_withdraw_block (block_number),
  KEY idx_withdraw_player (player_address_norm, chain_id, timestamp_utc)
) ENGINE=InnoDB;

-- bank_snapshots
DROP TABLE IF EXISTS bank_snapshots;
CREATE TABLE bank_snapshots (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_balance_wei  VARCHAR(78)     NOT NULL,
  chain_id              BIGINT UNSIGNED NOT NULL,
  block_number          BIGINT UNSIGNED NOT NULL,
  timestamp_utc         DATETIME        NOT NULL,
  created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bank_chain_block (chain_id, block_number),
  KEY idx_bank_time (timestamp_utc)
) ENGINE=InnoDB;

-- sessions
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
  id                VARCHAR(128)  NOT NULL,
  address_norm      VARCHAR(42)   NOT NULL,
  address_checksum  VARCHAR(42)   NOT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at        DATETIME      NOT NULL,
  last_used_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip                VARCHAR(64)   NULL,
  user_agent        VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  INDEX idx_sessions_address (address_norm),
  INDEX idx_sessions_exp (expires_at)
) ENGINE=InnoDB;

-- auth_nonces
DROP TABLE IF EXISTS auth_nonces;
CREATE TABLE auth_nonces (
  nonce        VARCHAR(128) NOT NULL,
  address_norm VARCHAR(42)  NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME     NOT NULL,
  used         BOOLEAN      NOT NULL DEFAULT 0,
  PRIMARY KEY (nonce),
  INDEX idx_nonces_exp_used (expires_at, used)
) ENGINE=InnoDB;

-- api_logs (business logs)
DROP TABLE IF EXISTS api_logs;
CREATE TABLE api_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level        ENUM('info','warn','error') NOT NULL DEFAULT 'info',
  source       VARCHAR(64)     NOT NULL,
  message      VARCHAR(512)    NOT NULL,
  context_json JSON            NULL,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_level_time (level, created_at)
) ENGINE=InnoDB;

-- http_logs (request logs)
DROP TABLE IF EXISTS http_logs;
CREATE TABLE http_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level      VARCHAR(16)     NOT NULL,
  message    VARCHAR(255)    NOT NULL,
  path       VARCHAR(255)    NULL,
  method     VARCHAR(16)     NULL,
  address    VARCHAR(42)     NULL,
  meta       TEXT            NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;
