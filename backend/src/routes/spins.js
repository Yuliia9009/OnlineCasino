// backend/src/routes/spins.js
import { Router } from "express";
import prisma from "../db.js";
import logger from "../utils/logger.js";

import { pickNetwork } from "../services/chain-resolver.js";
import { makeClients, parseSpinFromTx } from "../services/onchain.js";

const r = Router();

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);

const toInt = (v, d, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return d;
  return max ? Math.min(n, max) : n;
};
const normAddr = (a) => (a ? a.toLowerCase() : a);
const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h || "");

const toBig = (v) => (typeof v === "bigint" ? v : BigInt(v));

// Унифицированная «плоская» форма спина для JSON (без BigInt)
function toPlainSpin(row) {
  if (!row) return row;
  return {
    id: typeof row.id === "bigint" ? Number(row.id) : row.id,
    player_address_norm: row.player_address_norm ?? row.player_address,
    tx_hash: row.tx_hash,
    bet_wei: String(row.bet_wei),
    payout_wei: String(row.payout_wei),
    reel_1: Number(row.reel_1 ?? 0),
    reel_2: Number(row.reel_2 ?? 0),
    reel_3: Number(row.reel_3 ?? 0),
    block_number: typeof row.block_number === "bigint" ? Number(row.block_number) : Number(row.block_number ?? 0),
    timestamp_utc: row.timestamp_utc instanceof Date ? row.timestamp_utc : new Date(row.timestamp_utc),
  };
}

/* ========================= РОУТЫ ========================= */

// GET /api/spins?address=0x..&limit=&cursor=&chainId=
r.get("/", async (req, res) => {
  try {
    const addressRaw = req.query.address;
    const address = addressRaw ? normAddr(addressRaw) : null;
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 20, 100);
    const cursorId = req.query.cursor ? Number(req.query.cursor) : undefined;
    const cursor = cursorId ? { id: toBig(cursorId) } : undefined;

    if (addressRaw && !isAddress(addressRaw)) {
      return res.status(400).json({ ok: false, error: "bad_address" });
    }

    const where = { chain_id: toBig(chainId), ...(address ? { player_address_norm: address } : {}) };

    const items = await prisma.spins.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor } : {}),
      select: {
        id: true,
        player_address_norm: true,
        player_address: true,
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

    const plain = items.map(toPlainSpin);
    const nextCursor = plain.length ? plain[plain.length - 1].id : null;
    return res.json({ ok: true, items: plain, nextCursor });
  } catch (e) {
    logger.error(e, "spins:list_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Быстрый smoke-test
r.get("/test", async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 5, 100);
    const items = await prisma.spins.findMany({
      orderBy: { timestamp_utc: "desc" },
      take: limit,
    });
    res.json({ ok: true, spins: items.map(toPlainSpin) });
  } catch (e) {
    logger.error(e, "spins:test_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Старый путь /api/spins/history/:address
r.get("/history/:address", async (req, res) => {
  try {
    const addressRaw = req.params.address;
    if (!isAddress(addressRaw)) {
      return res.status(400).json({ ok: false, error: "bad_address" });
    }
    const address = normAddr(addressRaw);
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 20, 100);
    const cursorId = req.query.cursor ? Number(req.query.cursor) : undefined;
    const cursor = cursorId ? { id: toBig(cursorId) } : undefined;

    const items = await prisma.spins.findMany({
      where: { player_address_norm: address, chain_id: toBig(chainId) },
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

    const plain = items.map(toPlainSpin);
    const nextCursor = plain.length ? plain[plain.length - 1].id : null;
    res.json({ ok: true, items: plain, nextCursor });
  } catch (e) {
    logger.error(e, "spins:history_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Один спин по txHash
r.get("/by-tx/:txHash", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const tx = req.params.txHash;
    if (!isTxHash(tx)) {
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }
    const item = await prisma.spins.findFirst({
      where: { tx_hash: tx, chain_id: toBig(chainId) },
    });
    if (!item) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, item: toPlainSpin(item) });
  } catch (e) {
    logger.error(e, "spins:by_tx_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Последние спины по всей игре
r.get("/recent", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 30, 200);

    const items = await prisma.spins.findMany({
      where: { chain_id: toBig(chainId) },
      orderBy: { id: "desc" },
      take: limit,
      select: {
        id: true,
        player_address_norm: true,
        player_address: true,
        tx_hash: true,
        bet_wei: true,
        payout_wei: true,
        reel_1: true,
        reel_2: true,
        reel_3: true,
        timestamp_utc: true,
        block_number: true,
      },
    });

    res.json({ ok: true, items: items.map(toPlainSpin) });
  } catch (e) {
    logger.error(e, "spins:recent_error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * POST /api/spins/confirm
 * { txHash, expectedPlayer?, chainId? }
 */
r.post("/confirm", async (req, res) => {
  try {
    const { txHash, expectedPlayer } = req.body || {};
    if (!isTxHash(txHash)) {
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    const net = pickNetwork(req); // { chainId, rpcUrl, contract, confirmations }
    const { provider, iface, contractAddr } = makeClients(net);

    logger.info({ txHash, chainId: net.chainId }, "spins:confirm_parse");

    // Парсим событие из указанной транзакции
    const evt = await parseSpinFromTx({
      provider,
      iface,
      contractAddr,
      txHash, // прокидываем входной хэш
      confirmations: Number(net.confirmations || 0),
    });

    // Кто-то подменил игрока?
    if (expectedPlayer && expectedPlayer.toLowerCase() !== evt.player) {
      return res.status(409).json({ ok: false, error: "player_mismatch" });
    }

    // Идемпотентная вставка
    try {
      await prisma.spins.create({
        data: {
          chain_id: toBig(net.chainId),
          player_address: evt.playerChecksum ?? evt.player,
          player_address_norm: evt.player,
          bet_wei: String(evt.betWei),
          payout_wei: String(evt.payoutWei),
          reel_1: Number(evt.reels?.[0] ?? 0),
          reel_2: Number(evt.reels?.[1] ?? 0),
          reel_3: Number(evt.reels?.[2] ?? 0),
          tx_hash: txHash, // <— используем хэш из запроса, не рассчитываем на парсер
          block_number: toBig(evt.blockNumber ?? 0),
          timestamp_utc: new Date(evt.timestampMs || Date.now()),
        },
      });
      logger.info({ txHash, player: evt.player }, "spins:confirm_saved");
      return res.status(201).json({ ok: true, saved: { ...evt, txHash }, chainId: net.chainId });
    } catch (err) {
      if (err?.code === "P2002") {
        // UNIQUE(tx_hash, chain_id)
        logger.info({ txHash }, "spins:confirm_already");
        return res.json({ ok: true, alreadyConfirmed: true, saved: { ...evt, txHash }, chainId: net.chainId });
      }
      logger.error(err, "spins:confirm_insert_error");
      return res.status(500).json({ ok: false, error: "db_insert_failed" });
    }
  } catch (e) {
    if (e.code === "chain_not_configured") {
      return res.status(503).json({ ok: false, error: "chain_not_configured" });
    }
    logger.error(e, "spins:confirm_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;