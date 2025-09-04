import { Router } from "express";
import prisma from "../db.js";
import { pickNetwork } from "../services/chain-resolver.js";
import { makeClients, parseDepositFromTx } from "../services/onchain.js";
import logger from "../utils/logger.js"; 

const r = Router();
const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);

const toInt = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h);

/**
 * POST /api/deposits/confirm
 * Тело: { txHash, expectedPlayer?, chainId? }
 * Андрей: вызывать после успешной транзакции "deposit" в кошельке.
 */
r.post("/confirm", async (req, res) => {
  try {
    const { txHash, expectedPlayer } = req.body || {};
    if (!txHash || !isTxHash(txHash)) {
      logger.warn({ txHash }, "Bad or missing txHash in /deposits/confirm");
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    const net = pickNetwork(req); // { chainId, rpcUrl, contract, confirmations }
    const { provider, iface, contractAddr } = makeClients(net);

    logger.info({ txHash, chainId: net.chainId }, "Parsing Deposit event");

    // парсим событие Deposit(...) из транзакции
    const evt = await parseDepositFromTx({ provider, iface, contractAddr, txHash });

    if (expectedPlayer && expectedPlayer.toLowerCase() !== evt.player) {
      logger.warn(
        { txHash, expectedPlayer, actual: evt.player },
        "Player mismatch on deposit"
      );
      return res.status(409).json({ ok: false, error: "player_mismatch" });
    }

    // идемпотентная запись (уникальный ключ по tx_hash+chain_id)
    try {
      await prisma.deposits.create({
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
      logger.info({ txHash, player: evt.player }, "Deposit saved");
    } catch (dbErr) {
      logger.info({ txHash }, "Deposit already confirmed, skipping insert");
      return res.json({ ok: true, alreadyConfirmed: true, saved: evt });
    }

    // можно обновить агрегаты игрока (по желанию)
    // await prisma.players.update({ ... }) или дернуть /players/:address/recalc

    return res.json({ ok: true, saved: evt, chainId: net.chainId });
  } catch (e) {
    if (e.code === "chain_not_configured") {
      logger.error({ chainId: req.body?.chainId }, "Chain not configured");
      return res.status(503).json({ ok: false, error: "chain_not_configured" });
    }
    logger.error(e, "Unexpected error in /deposits/confirm");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;