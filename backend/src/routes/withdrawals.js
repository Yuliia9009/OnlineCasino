import { Router } from "express";
import prisma from "../db.js";
import { pickNetwork } from "../services/chain-resolver.js";
import { makeClients, parseWithdrawFromTx } from "../services/onchain.js";
import logger from "../utils/logger.js";

const r = Router();
const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h);

/**
 * POST /api/withdrawals/confirm
 * Тело: { txHash, expectedPlayer?, chainId? }
 * Андрей: вызывать после успешной транзакции "withdraw" в кошельке.
 */
r.post("/confirm", async (req, res) => {
  try {
    const { txHash, expectedPlayer } = req.body || {};
    if (!txHash || !isTxHash(txHash)) {
      logger.warn({ txHash }, "Bad or missing txHash in /withdrawals/confirm");
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    const net = pickNetwork(req);
    const { provider, iface, contractAddr } = makeClients(net);

    logger.info({ txHash, chainId: net.chainId }, "Parsing Withdraw event");

    // парсим событие Withdraw(...) из транзакции
    const evt = await parseWithdrawFromTx({ provider, iface, contractAddr, txHash });

    if (expectedPlayer && expectedPlayer.toLowerCase() !== evt.player) {
      logger.warn({ txHash, expectedPlayer, actual: evt.player }, "Player mismatch on withdraw");
      return res.status(409).json({ ok: false, error: "player_mismatch" });
    }

    try {
      await prisma.withdrawals.create({
        data: {
          chain_id: net.chainId,
          player_address_norm: evt.player,
          address_checksum: evt.playerChecksum ?? evt.player,
          amount_wei: evt.amountWei,
          tx_hash: evt.txHash,
          block_number: evt.blockNumber,
          timestamp_utc: new Date(evt.timestampMs),
          status: "ok",
        },
      });
      logger.info({ txHash, player: evt.player }, "Withdrawal saved");
    } catch (dbErr) {
      logger.info({ txHash }, "Withdrawal already confirmed, skipping insert");
      return res.json({ ok: true, alreadyConfirmed: true, saved: evt });
    }

    return res.json({ ok: true, saved: evt, chainId: net.chainId });
  } catch (e) {
    if (e.code === "chain_not_configured") {
      logger.error({ chainId: req.body?.chainId }, "Chain not configured");
      return res.status(503).json({ ok: false, error: "chain_not_configured" });
    }
    logger.error(e, "Unexpected error in /withdrawals/confirm");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;