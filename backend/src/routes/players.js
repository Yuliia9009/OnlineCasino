import { Router } from "express";
import prisma from "../db.js";
import logger from "../utils/logger.js";
import auth from "../middlewares/auth.js";

const r = Router();

/* ============ УТИЛИТЫ И КОНСТАНТЫ ============ */

/** дефолтная сеть — Sepolia; можно переопределить в .env */
const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);

/** безопасное целое с дефолтом и верхним лимитом */
const toInt = (v, d, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return d;
  return max ? Math.min(n, max) : n;
};

/** адреса храним/сравниваем в lowercase (UI показывает checksum) */
const normAddr = (a) => (a ? a.toLowerCase() : a);

/** базовая проверка Ethereum-адреса */
const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");

/* ============ РОУТЫ ============ */

/**
 * GET /api/players/:address/summary?chainId=
 */
r.get("/:address/summary", async (req, res) => {
  try {
    const address = normAddr(req.params.address);
    if (!isAddress(address)) {
      logger.warn({ address: req.params.address }, "players/summary: bad_address");
      return res.status(400).json({ ok: false, error: "bad_address" });
    }

    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    logger.info({ address, chainId }, "players/summary: fetching");

    const player = await prisma.players.findFirst({
      where: { address_norm: address, chain_id: chainId },
      select: {
        id: true,
        address_checksum: true,
        total_spins: true,
        total_deposited_wei: true,
        total_bet_wei: true,
        total_payout_wei: true,
        total_withdrawn_wei: true,
        net_wei: true,
        updated_at: true,
      },
    });

    logger.info(
      { address, chainId, found: Boolean(player) },
      "players/summary: done"
    );
    return res.json({ ok: true, player: player || null });
  } catch (e) {
    logger.error(e, "players/summary: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// --- Приватные, требуют входа через SIWE ---
r.get("/me/spins", auth(true), async (req, res) => {
  const address = req.user.addressNorm;
  const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
  const limit = toInt(req.query.limit, 20, 100);
  const cursorId = req.query.cursor ? Number(req.query.cursor) : undefined;
  const cursor = cursorId ? { id: cursorId } : undefined;

  const items = await prisma.spins.findMany({
    where: { player_address_norm: address, chain_id: chainId },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor } : {}),
    select: {
      id: true, tx_hash: true, bet_wei: true, payout_wei: true,
      reel_1: true, reel_2: true, reel_3: true,
      block_number: true, timestamp_utc: true,
    },
  });

  const nextCursor = items.length ? items[items.length - 1].id : null;
  return res.json({ ok: true, items, nextCursor });
});

// GET /api/players/:address/spins?chainId=&limit=&cursor=
r.get("/:address/spins", async (req, res) => {
  try {
    const address = normAddr(req.params.address);
    if (!isAddress(address)) {
      logger.warn({ address: req.params.address }, "players/spins: bad_address");
      return res.status(400).json({ ok: false, error: "bad_address" });
    }

    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 20, 100);
    const cursorId = req.query.cursor ? Number(req.query.cursor) : undefined;
    const cursor = cursorId ? { id: cursorId } : undefined;

    logger.info({ address, chainId, limit, cursorId }, "players/spins: fetching");

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

    logger.info(
      { address, chainId, count: items.length, nextCursor },
      "players/spins: done"
    );
    return res.json({ ok: true, items, nextCursor });
  } catch (e) {
    logger.error(e, "players/spins: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// --- Приватные, требуют входа через SIWE ---
r.get("/me/summary", auth(true), async (req, res) => {
  const address = req.user.addressNorm;              // из cookie-сессии
  const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
  const player = await prisma.players.findFirst({
    where: { address_norm: address, chain_id: chainId },
    select: {
      id: true, address_checksum: true, total_spins: true,
      total_deposited_wei: true, total_bet_wei: true,
      total_payout_wei: true, total_withdrawn_wei: true,
      net_wei: true, updated_at: true,
    },
  });
  return res.json({ ok: true, player: player || null });
});

// POST /api/players/:address/recalc?chainId=
r.post("/:address/recalc", async (req, res) => {
  try {
    const address = normAddr(req.params.address);
    if (!isAddress(address)) {
      logger.warn({ address: req.params.address }, "players/recalc: bad_address");
      return res.status(400).json({ ok: false, error: "bad_address" });
    }
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    logger.info({ address, chainId }, "players/recalc: start");

    const result = await prisma.$transaction(async (tx) => {
      const [spins, deposits, withdrawals] = await Promise.all([
        tx.spins.findMany({
          where: { player_address_norm: address, chain_id: chainId },
          select: { bet_wei: true, payout_wei: true },
        }),
        tx.deposits.findMany({
          where: { player_address_norm: address, chain_id: chainId, status: "ok" },
          select: { amount_wei: true },
        }),
        tx.withdrawals.findMany({
          where: {
            player_address_norm: address,
            chain_id: chainId,
            status: { in: ["ok", "pending"] },
          },
          select: { amount_wei: true },
        }),
      ]);

      const sumWei = (arr, field) => arr.reduce((a, x) => a + BigInt(x[field]), 0n);
      const totalBet = sumWei(spins, "bet_wei");
      const totalPayout = sumWei(spins, "payout_wei");
      const totalDeposited = sumWei(deposits, "amount_wei");
      const totalWithdrawn = sumWei(withdrawals, "amount_wei");
      const totalSpins = BigInt(spins.length);
      const net = totalPayout + totalWithdrawn - totalDeposited - totalBet;

      const upserted = await tx.players.upsert({
        where: { address_norm_chain_id: { address_norm: address, chain_id: chainId } },
        update: {
          total_spins: Number(totalSpins),
          total_deposited_wei: totalDeposited.toString(),
          total_bet_wei: totalBet.toString(),
          total_payout_wei: totalPayout.toString(),
          total_withdrawn_wei: totalWithdrawn.toString(),
          net_wei: net.toString(),
        },
        create: {
          address_checksum: req.body?.addressChecksum || address,
          address_norm: address,
          chain_id: chainId,
          total_spins: Number(totalSpins),
          total_deposited_wei: totalDeposited.toString(),
          total_bet_wei: totalBet.toString(),
          total_payout_wei: totalPayout.toString(),
          total_withdrawn_wei: totalWithdrawn.toString(),
          net_wei: net.toString(),
        },
      });

      return upserted;
    });

    logger.info({ address, chainId }, "players/recalc: done");
    return res.json({ ok: true, player: result });
  } catch (e) {
    logger.error(e, "players/recalc: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/players/leaderboard/top?chainId=&metric=&limit=
r.get("/leaderboard/top", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 10, 50);
    const metric = (req.query.metric || "total_payout_wei").toString();

    const allowed = new Set(["total_payout_wei", "net_wei", "total_spins"]);
    if (!allowed.has(metric)) {
      logger.warn({ metric }, "players/leaderboard: bad_metric");
      return res.status(400).json({ ok: false, error: "bad_metric" });
    }

    logger.info({ chainId, limit, metric }, "players/leaderboard: fetching");

    const orderBy =
      metric === "total_spins"
        ? { total_spins: "desc" }
        : { [metric]: "desc" };

    const top = await prisma.players.findMany({
      where: { chain_id: chainId },
      orderBy,
      take: limit,
      select: {
        address_checksum: true,
        total_spins: true,
        total_deposited_wei: true,
        total_bet_wei: true,
        total_payout_wei: true,
        total_withdrawn_wei: true,
        net_wei: true,
      },
    });

    logger.info({ chainId, metric, count: top.length }, "players/leaderboard: done");
    return res.json({ ok: true, metric, top });
  } catch (e) {
    logger.error(e, "players/leaderboard: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;