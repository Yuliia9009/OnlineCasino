-- 1) База
CREATE DATABASE
IF NOT EXISTS onlinecasino
  CHARACTER
SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE onlinecasino;

-- 2) Игроки (агрегаты)
CREATE TABLE
IF NOT EXISTS players
(
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  address_checksum  CHAR
(42)  NOT NULL,    -- как пришло из события (EIP-55)
  address_norm      CHAR
(42)  AS
(LOWER
(address_checksum)) STORED,
  chain_id          BIGINT UNSIGNED NOT NULL DEFAULT 11155111, -- пример: Sepolia
  total_spins       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_deposited_wei  VARCHAR
(78) NOT NULL DEFAULT '0',
  total_bet_wei        VARCHAR
(78) NOT NULL DEFAULT '0',
  total_payout_wei     VARCHAR
(78) NOT NULL DEFAULT '0',
  total_withdrawn_wei  VARCHAR
(78) NOT NULL DEFAULT '0',
  net_wei              VARCHAR
(78) NOT NULL DEFAULT '0', -- payout + withdrawn - deposited - bet
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY
(id),
  UNIQUE KEY uq_player_addr_chain
(address_norm, chain_id),
  KEY idx_player_updated
(updated_at)
) ENGINE=InnoDB;

-- 3) Депозиты
CREATE TABLE
IF NOT EXISTS deposits
(
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tx_hash          CHAR
(66)  NOT NULL,
  player_address   CHAR
(42)  NOT NULL,
  player_address_norm CHAR
(42) AS
(LOWER
(player_address)) STORED,
  chain_id         BIGINT UNSIGNED NOT NULL,
  amount_wei       VARCHAR
(78) NOT NULL,
  block_number     BIGINT UNSIGNED NOT NULL,
  timestamp_utc    DATETIME NOT NULL,                 -- из блока
  status           ENUM
('ok','failed') NOT NULL DEFAULT 'ok',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY
(id),
  UNIQUE KEY uq_deposit_tx
(tx_hash, chain_id),       -- идемпотентность
  KEY idx_deposit_player
(player_address_norm, chain_id, timestamp_utc),
  KEY idx_deposit_block
(block_number)
) ENGINE=InnoDB;

-- 4) Спины
CREATE TABLE
IF NOT EXISTS spins
(
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tx_hash          CHAR
(66)  NOT NULL,
  player_address   CHAR
(42)  NOT NULL,
  player_address_norm CHAR
(42) AS
(LOWER
(player_address)) STORED,
  chain_id         BIGINT UNSIGNED NOT NULL,
  bet_wei          VARCHAR
(78) NOT NULL,
  payout_wei       VARCHAR
(78) NOT NULL,
  -- результат барабанов: 3 числа. для быстрых фильтров оставим отдельные колонки.
  reel_1           INT NOT NULL,
  reel_2           INT NOT NULL,
  reel_3           INT NOT NULL,
  rnd_seed         VARCHAR
(78) NULL,                  -- опционально
  block_number     BIGINT UNSIGNED NOT NULL,
  timestamp_utc    DATETIME NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY
(id),
  UNIQUE KEY uq_spin_tx
(tx_hash, chain_id),
  KEY idx_spin_player
(player_address_norm, chain_id, timestamp_utc),
  KEY idx_spin_block
(block_number)
) ENGINE=InnoDB;

-- 5) Выводы
CREATE TABLE
IF NOT EXISTS withdrawals
(
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tx_hash          CHAR
(66)  NOT NULL,
  player_address   CHAR
(42)  NOT NULL,
  player_address_norm CHAR
(42) AS
(LOWER
(player_address)) STORED,
  chain_id         BIGINT UNSIGNED NOT NULL,
  amount_wei       VARCHAR
(78) NOT NULL,
  block_number     BIGINT UNSIGNED NOT NULL,
  timestamp_utc    DATETIME NOT NULL,
  status           ENUM
('ok','failed','pending') NOT NULL DEFAULT 'ok',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY
(id),
  UNIQUE KEY uq_withdraw_tx
(tx_hash, chain_id),
  KEY idx_withdraw_player
(player_address_norm, chain_id, timestamp_utc),
  KEY idx_withdraw_block
(block_number)
) ENGINE=InnoDB;

-- 6) Снепшоты банка/трезори (опционально)
CREATE TABLE
IF NOT EXISTS bank_snapshots
(
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_balance_wei VARCHAR
(78) NOT NULL,
  chain_id             BIGINT UNSIGNED NOT NULL,
  block_number         BIGINT UNSIGNED NOT NULL,
  timestamp_utc        DATETIME NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY
(id),
  KEY idx_bank_chain_block
(chain_id, block_number),
  KEY idx_bank_time
(timestamp_utc)
) ENGINE=InnoDB;

-- 7) Логи API/ошибок (опционально, удобно для аудита)
CREATE TABLE
IF NOT EXISTS api_logs
(
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level          ENUM
('info','warn','error') NOT NULL DEFAULT 'info',
  source         VARCHAR
(64) NOT NULL,               -- spins.confirm / listener / cron
  message        VARCHAR
(512) NOT NULL,
  context_json   JSON NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY
(id),
  KEY idx_logs_level_time
(level, created_at)
) ENGINE=InnoDB;
