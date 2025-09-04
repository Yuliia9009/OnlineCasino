import { Router } from "express";
import prisma from "../db.js";
import logger from "../utils/logger.js";

import { pickNetwork } from "../services/chain-resolver.js";
import { makeClients, parseSpinFromTx } from "../services/onchain.js";

const r = Router();

/* ========================= УТИЛИТЫ ========================= */

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);

const toInt = (v, d, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return d;
  return max ? Math.min(n, max) : n;
};
const normAddr = (a) => (a ? a.toLowerCase() : a);
const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h);

/* ========================= РОУТЫ ========================= */

/** Быстрый smoke-test (есть ли соединение с БД). */
r.get("/test", async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 5, 100);
    const items = await prisma.spins.findMany({
      orderBy: { timestamp_utc: "desc" },
      take: limit,
    });
    res.json({ ok: true, spins: items });
  } catch (e) {
    logger.error(e, "spins/test: unexpected_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** История конкретного игрока (пагинация по cursor=id). */
r.get("/history/:address", async (req, res) => {
  try {
    const address = normAddr(req.params.address);
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 20, 100);
    const cursorId = req.query.cursor ? Number(req.query.cursor) : undefined;
    const cursor = cursorId ? { id: cursorId } : undefined;

    logger.info({ address, chainId, limit, cursorId }, "spins/history: fetching");

    const items = await prisma.spins.findMany({
      where: { player_address_norm: address, chain_id: chainId },
      orderBy: { id: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor } : {}),
      select: {
        id: true,
        tx_hash: true,
        bet_wei: true,
        payout_wei: true,
        reel_1: true,
        reel_2: true,
        reel_3: true,
        block_number: true,
        timestamp_utc: true,
      },
    });

    const nextCursor = items.length ? items[items.length - 1].id : null;

    logger.info({ address, chainId, count: items.length, nextCursor }, "spins/history: done");
    res.json({ ok: true, items, nextCursor });
  } catch (e) {
    logger.error(e, "spins/history: unexpected_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** Получить один спин по транзакции. */
r.get("/by-tx/:txHash", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const tx = req.params.txHash;
    if (!isTxHash(tx)) {
      logger.warn({ tx }, "spins/by-tx: bad_tx_hash");
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    const item = await prisma.spins.findFirst({
      where: { tx_hash: tx, chain_id: chainId },
    });
    if (!item) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, item });
  } catch (e) {
    logger.error(e, "spins/by-tx: unexpected_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** Последние спины по всей игре (лента активности). */
r.get("/recent", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 30, 100);

    const items = await prisma.spins.findMany({
      where: { chain_id: chainId },
      orderBy: { id: "desc" },
      take: limit,
      select: {
        id: true,
        player_address_norm: true,
        tx_hash: true,
        bet_wei: true,
        payout_wei: true,
        reel_1: true,
        reel_2: true,
        reel_3: true,
        timestamp_utc: true,
      },
    });

    res.json({ ok: true, items });
  } catch (e) {
    logger.error(e, "spins/recent: unexpected_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Принять txHash, распарсить SpinResult и сохранить (идемпотентно).
 * Тело: { txHash, expectedPlayer?, chainId? }
 */
r.post("/confirm", async (req, res) => {
  try {
    const { txHash, expectedPlayer } = req.body || {};
    if (!txHash) {
      logger.warn("spins/confirm: txHash required");
      return res.status(400).json({ ok: false, error: "txHash required" });
    }
    if (!isTxHash(txHash)) {
      logger.warn({ txHash }, "spins/confirm: bad_tx_hash");
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    const net = pickNetwork(req); // { chainId, rpcUrl, contract, confirmations }
    const { provider, iface, contractAddr } = makeClients(net);

    logger.info({ txHash, chainId: net.chainId }, "spins/confirm: parsing SpinResult");

    const evt = await parseSpinFromTx({ provider, iface, contractAddr, txHash });

    if (expectedPlayer && expectedPlayer.toLowerCase() !== evt.player) {
      logger.warn({ txHash, expectedPlayer, actual: evt.player }, "spins/confirm: player_mismatch");
      return res.status(409).json({ ok: false, error: "player_mismatch" });
    }

    // идемпотентная запись — предполагается UNIQUE(tx_hash, chain_id) в таблице spins
    try {
      await prisma.spins.create({
        data: {
          chain_id: net.chainId,
          player_address_norm: evt.player,
          address_checksum: evt.playerChecksum ?? evt.player,
          bet_wei: evt.betWei,
          payout_wei: evt.payoutWei,
          reel_1: evt.reels?.[0] ?? null,
          reel_2: evt.reels?.[1] ?? null,
          reel_3: evt.reels?.[2] ?? null,
          tx_hash: evt.txHash,
          block_number: evt.blockNumber,
          timestamp_utc: new Date(evt.timestampMs),
        },
      });
      logger.info({ txHash, player: evt.player }, "spins/confirm: saved");
    } catch (dbErr) {
      // если дубликат, считаем подтверждённым
      logger.info({ txHash }, "spins/confirm: already_confirmed");
      return res.json({ ok: true, alreadyConfirmed: true, saved: evt, chainId: net.chainId });
    }

    return res.json({ ok: true, saved: evt, chainId: net.chainId });
  } catch (e) {
    if (e.code === "chain_not_configured") {
      logger.error({ chainId: req.body?.chainId }, "spins/confirm: chain_not_configured");
      return res.status(503).json({ ok: false, error: "chain_not_configured" });
    }
    logger.error(e, "spins/confirm: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;