import dotenv from "dotenv";
dotenv.config();

import logger from "../utils/logger.js";

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);

/**
 * Преобразует сырой chainId (query/body) в валидный number.
 * Если невалидный → берём дефолт из .env.
 */
export function resolveChainId(raw) {
  const n = Number(raw);
  const resolved = Number.isFinite(n) && n > 0 ? n : DEFAULT_CHAIN_ID;

  if (resolved === DEFAULT_CHAIN_ID && raw !== undefined) {
    logger.warn(
      { raw, fallback: DEFAULT_CHAIN_ID },
      "resolveChainId: invalid chainId, using default"
    );
  } else {
    logger.debug({ raw, resolved }, "resolveChainId");
  }

  return resolved;
}

/**
 * Загружает сетевой конфиг из .env по chainId.
 * Формат: RPC_URL_${chainId}, CONTRACT_ADDRESS_${chainId}, CONFIRMATIONS_${chainId}.
 */
export function getNetworkConfig(chainId) {
  const rpcUrlKey = `RPC_URL_${chainId}`;
  const contractKey = `CONTRACT_ADDRESS_${chainId}`;
  const confirmationsKey = `CONFIRMATIONS_${chainId}`;

  const rpcUrl = process.env[rpcUrlKey];
  const contract = process.env[contractKey];
  const confirmations = Number(process.env[confirmationsKey] || 0);

  if (!rpcUrl || !contract) {
    logger.error(
      { chainId, rpcUrlKey, contractKey, found: { rpcUrl, contract } },
      "getNetworkConfig: missing RPC or contract address"
    );
    return null;
  }

  logger.info(
    { chainId, rpcUrl, contract, confirmations },
    "getNetworkConfig: loaded"
  );

  return { chainId, rpcUrl, contract, confirmations };
}