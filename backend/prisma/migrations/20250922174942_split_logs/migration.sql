-- CreateTable
CREATE TABLE `players` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `address_checksum` CHAR(42) NOT NULL,
    `address_norm` CHAR(42) NULL,
    `chain_id` BIGINT UNSIGNED NOT NULL DEFAULT 31337,
    `total_spins` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `total_deposited_wei` VARCHAR(78) NOT NULL DEFAULT '0',
    `total_bet_wei` VARCHAR(78) NOT NULL DEFAULT '0',
    `total_payout_wei` VARCHAR(78) NOT NULL DEFAULT '0',
    `total_withdrawn_wei` VARCHAR(78) NOT NULL DEFAULT '0',
    `net_wei` VARCHAR(78) NOT NULL DEFAULT '0',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_player_updated`(`updated_at`),
    UNIQUE INDEX `uq_player_addr_chain`(`address_norm`, `chain_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposits` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tx_hash` CHAR(66) NOT NULL,
    `player_address` CHAR(42) NOT NULL,
    `player_address_norm` CHAR(42) NULL,
    `chain_id` BIGINT UNSIGNED NOT NULL,
    `amount_wei` VARCHAR(78) NOT NULL,
    `block_number` BIGINT UNSIGNED NOT NULL,
    `timestamp_utc` DATETIME(0) NOT NULL,
    `status` ENUM('ok', 'failed') NOT NULL DEFAULT 'ok',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_deposit_block`(`block_number`),
    INDEX `idx_deposit_player`(`player_address_norm`, `chain_id`, `timestamp_utc`),
    UNIQUE INDEX `uq_deposit_tx`(`tx_hash`, `chain_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spins` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tx_hash` CHAR(66) NOT NULL,
    `player_address` CHAR(42) NOT NULL,
    `player_address_norm` CHAR(42) NULL,
    `chain_id` BIGINT UNSIGNED NOT NULL,
    `bet_wei` VARCHAR(78) NOT NULL,
    `payout_wei` VARCHAR(78) NOT NULL,
    `reel_1` INTEGER NOT NULL,
    `reel_2` INTEGER NOT NULL,
    `reel_3` INTEGER NOT NULL,
    `rnd_seed` VARCHAR(78) NULL,
    `block_number` BIGINT UNSIGNED NOT NULL,
    `timestamp_utc` DATETIME(0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_spin_block`(`block_number`),
    INDEX `idx_spin_player`(`player_address_norm`, `chain_id`, `timestamp_utc`),
    UNIQUE INDEX `uq_spin_tx`(`tx_hash`, `chain_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `withdrawals` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tx_hash` CHAR(66) NOT NULL,
    `player_address` CHAR(42) NOT NULL,
    `player_address_norm` CHAR(42) NULL,
    `chain_id` BIGINT UNSIGNED NOT NULL,
    `amount_wei` VARCHAR(78) NOT NULL,
    `block_number` BIGINT UNSIGNED NOT NULL,
    `timestamp_utc` DATETIME(0) NOT NULL,
    `status` ENUM('ok', 'failed', 'pending') NOT NULL DEFAULT 'ok',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_withdraw_block`(`block_number`),
    INDEX `idx_withdraw_player`(`player_address_norm`, `chain_id`, `timestamp_utc`),
    UNIQUE INDEX `uq_withdraw_tx`(`tx_hash`, `chain_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_snapshots` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `contract_balance_wei` VARCHAR(78) NOT NULL,
    `chain_id` BIGINT UNSIGNED NOT NULL,
    `block_number` BIGINT UNSIGNED NOT NULL,
    `timestamp_utc` DATETIME(0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_bank_chain_block`(`chain_id`, `block_number`),
    INDEX `idx_bank_time`(`timestamp_utc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(128) NOT NULL,
    `address_norm` VARCHAR(42) NOT NULL,
    `address_checksum` VARCHAR(42) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(255) NULL,

    INDEX `sessions_address_norm_idx`(`address_norm`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_nonces` (
    `nonce` VARCHAR(128) NOT NULL,
    `address_norm` VARCHAR(42) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,

    INDEX `auth_nonces_expires_at_used_idx`(`expires_at`, `used`),
    PRIMARY KEY (`nonce`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `level` ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
    `source` VARCHAR(64) NOT NULL,
    `message` VARCHAR(512) NOT NULL,
    `context_json` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_logs_level_time`(`level`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `http_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `level` VARCHAR(16) NOT NULL,
    `message` VARCHAR(255) NOT NULL,
    `path` VARCHAR(255) NULL,
    `method` VARCHAR(16) NULL,
    `address` VARCHAR(42) NULL,
    `meta` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
