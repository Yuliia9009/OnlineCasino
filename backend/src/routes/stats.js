import { Router } from "express";
import prisma from "../db.js";
import logger from "../utils/logger.js"; 

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

/** агрегатор BigInt → string */
const sumWei = (arr, field) => arr.reduce((a, x) => a + BigInt(x[field]), 0n);

/* ============ РОУТЫ ============ */

/**
 * GET /api/stats/summary?chainId=
 * Общая сводка по всей игре.
 */
r.get("/summary", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    logger.info({ chainId }, "stats/summary: calculating");

    const totalSpins = await prisma.spins.count({ where: { chain_id: chainId } });

    const [spinsAgg, depositsAgg, withdrawalsAgg] = await Promise.all([
      prisma.spins.findMany({
        where: { chain_id: chainId },
        select: { bet_wei: true, payout_wei: true },
      }),
      prisma.deposits.findMany({
        where: { chain_id: chainId, status: "ok" },
        select: { amount_wei: true },
      }),
      prisma.withdrawals.findMany({
        where: { chain_id: chainId, status: { in: ["ok", "pending"] } },
        select: { amount_wei: true },
      }),
    ]);

    const totalBetWei = sumWei(spinsAgg, "bet_wei");
    const totalPayoutWei = sumWei(spinsAgg, "payout_wei");
    const totalDepositedWei = sumWei(depositsAgg, "amount_wei");
    const totalWithdrawnWei = sumWei(withdrawalsAgg, "amount_wei");

    const rtp =
      totalBetWei === 0n ? 0 : Number((totalPayoutWei * 10000n) / totalBetWei) / 100;

    logger.info(
      {
        chainId,
        totalSpins,
        totals: {
          bet: totalBetWei.toString(),
          payout: totalPayoutWei.toString(),
          deposited: totalDepositedWei.toString(),
          withdrawn: totalWithdrawnWei.toString(),
          rtp,
        },
      },
      "stats/summary: done"
    );

    return res.json({
      ok: true,
      chainId,
      totalSpins,
      totals: {
        totalBetWei: totalBetWei.toString(),
        totalPayoutWei: totalPayoutWei.toString(),
        totalDepositedWei: totalDepositedWei.toString(),
        totalWithdrawnWei: totalWithdrawnWei.toString(),
        RTP_percent: rtp,
      },
    });
  } catch (e) {
    logger.error(e, "stats/summary: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/stats/rtp?window=7d&chainId=
 * RTP (return-to-player) за выбранный период.
 */
r.get("/rtp", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const window = (req.query.window || "7d").toLowerCase(); // '24h' | '7d' | '30d'
    const now = new Date();

    let since;
    if (window.endsWith("d")) {
      const days = toInt(window, 7, 365);
      since = new Date(now.getTime() - days * 24 * 3600 * 1000);
    } else if (window.endsWith("h")) {
      const hours = toInt(window, 24, 24 * 30);
      since = new Date(now.getTime() - hours * 3600 * 1000);
    } else {
      since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    }

    logger.info({ chainId, window, since }, "stats/rtp: calculating");

    const items = await prisma.spins.findMany({
      where: { chain_id: chainId, timestamp_utc: { gte: since } },
      select: { bet_wei: true, payout_wei: true },
    });

    const bet = sumWei(items, "bet_wei");
    const payout = sumWei(items, "payout_wei");
    const rtp = bet === 0n ? 0 : Number((payout * 10000n) / bet) / 100;

    logger.info(
      { chainId, window, count: items.length, bet: bet.toString(), payout: payout.toString(), rtp },
      "stats/rtp: done"
    );

    return res.json({
      ok: true,
      chainId,
      window,
      betWei: bet.toString(),
      payoutWei: payout.toString(),
      RTP_percent: rtp,
    });
  } catch (e) {
    logger.error(e, "stats/rtp: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/stats/leaderboard?metric=total_payout_wei&limit=10&chainId=
 */
r.get("/leaderboard", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 10, 50);
    const metric = (req.query.metric || "total_payout_wei").toString();

    const allowed = new Set(["total_payout_wei", "net_wei", "total_spins"]);
    if (!allowed.has(metric)) {
      logger.warn({ metric }, "stats/leaderboard: bad_metric");
      return res.status(400).json({ ok: false, error: "bad_metric" });
    }

    logger.info({ chainId, limit, metric }, "stats/leaderboard: fetching");

    const orderBy =
      metric === "total_spins" ? { total_spins: "desc" } : { [metric]: "desc" };

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

    logger.info({ chainId, metric, count: top.length }, "stats/leaderboard: done");

    return res.json({ ok: true, metric, top });
  } catch (e) {
    logger.error(e, "stats/leaderboard: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;