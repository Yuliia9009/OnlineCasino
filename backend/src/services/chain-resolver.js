import { resolveChainId, getNetworkConfig } from "./networks.js";
import logger from "../utils/logger.js"; 

export function pickNetwork(req) {
  const chainId = resolveChainId(req.query.chainId ?? req.body?.chainId);

  logger.debug({ chainId }, "pickNetwork: resolving config");

  const cfg = getNetworkConfig(chainId);
  if (!cfg) {
    const e = new Error(`Network ${chainId} not configured`);
    e.code = "chain_not_configured";
    logger.warn({ chainId }, "pickNetwork: missing config");
    throw e;
  }

  logger.info({ chainId, rpcUrl: cfg.rpcUrl }, "pickNetwork: using network");
  return cfg;
}