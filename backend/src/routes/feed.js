import { Router } from "express";
import prisma from "../db.js";
import logger from "../utils/logger.js";


const r = Router();

/* ========================= УТИЛИТЫ ========================= */

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);

const toInt = (v, d, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return d;
  return max ? Math.min(n, max) : n;
};

const normAddr = (a) => (a ? a.toLowerCase() : a);
const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");

/* ========================= МАППЕРЫ ========================= */

function mapSpin(x) {
  return {
    type: "spin",
    tx_hash: x.tx_hash,
    address_norm: x.player_address_norm,
    address_checksum: x.player_address ?? x.address_checksum ?? null,
    bet_wei: x.bet_wei,
    payout_wei: x.payout_wei,
    reels: [x.reel_1, x.reel_2, x.reel_3],
    block_number: x.block_number,
    timestamp_utc: x.timestamp_utc,
  };
}

function mapDeposit(x) {
  return {
    type: "deposit",
    tx_hash: x.tx_hash,
    address_norm: x.player_address_norm,
    address_checksum: x.player_address ?? x.address_checksum ?? null,
    amount_wei: x.amount_wei,
    block_number: x.block_number,
    timestamp_utc: x.timestamp_utc,
    status: x.status ?? "ok",
  };
}

function mapWithdraw(x) {
  return {
    type: "withdraw",
    tx_hash: x.tx_hash,
    address_norm: x.player_address_norm,
    address_checksum: x.player_address ?? x.address_checksum ?? null,
    amount_wei: x.amount_wei,
    block_number: x.block_number,
    timestamp_utc: x.timestamp_utc,
    status: x.status ?? "ok",
  };
}

/* ========================= РОУТЫ ========================= */

/**
 * GET /api/feed
 * Параметры:
 *   - chainId?   (default: env.CHAIN_ID_DEFAULT или 11155111)
 *   - limit?     (сколько элементов в сумме, default: 30, max: 200)
 *   - address?   (фильтр по адресу игрока, опционально)
 *
 * Возвращает смешанную ленту событий (спины, депозиты, выводы), отсортированную по времени (timestamp_utc desc).
 */
r.get("/", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 30, 200);
    const addressQ = normAddr(req.query.address);

    if (addressQ && !isAddress(addressQ)) {
      return res.status(400).json({ ok: false, error: "bad_address" });
    }

    // Берём с запасом по каждому типу, потом сольём и порежем.
    // Коэффициент 2x помогает, если один тип доминирует за период.
    const perType = Math.max(10, Math.ceil(limit * 2));

    const commonWhere = { chain_id: chainId };
    const byAddress = addressQ ? { player_address_norm: addressQ } : {};

    const [spins, deposits, withdrawals] = await Promise.all([
      prisma.spins.findMany({
        where: { ...commonWhere, ...byAddress },
        orderBy: { timestamp_utc: "desc" },
        take: perType,
        select: {
          tx_hash: true,
          player_address: true,
          player_address_norm: true,
          bet_wei: true,
          payout_wei: true,
          reel_1: true,
          reel_2: true,
          reel_3: true,
          block_number: true,
          timestamp_utc: true,
        },
      }),
      prisma.deposits.findMany({
        where: { ...commonWhere, ...byAddress },
        orderBy: { timestamp_utc: "desc" },
        take: perType,
        select: {
          tx_hash: true,
          player_address: true,
          player_address_norm: true,
          amount_wei: true,
          block_number: true,
          timestamp_utc: true,
          status: true,
        },
      }),
      prisma.withdrawals.findMany({
        where: { ...commonWhere, ...byAddress },
        orderBy: { timestamp_utc: "desc" },
        take: perType,
        select: {
          tx_hash: true,
          player_address: true,
          player_address_norm: true,
          amount_wei: true,
          block_number: true,
          timestamp_utc: true,
          status: true,
        },
      }),
    ]);

    const merged = [
      ...spins.map(mapSpin),
      ...deposits.map(mapDeposit),
      ...withdrawals.map(mapWithdraw),
    ]
      .filter((x) => x.timestamp_utc) // на всякий случай
      .sort((a, b) => new Date(b.timestamp_utc) - new Date(a.timestamp_utc))
      .slice(0, limit);

    logger.info(
      { chainId, limit, address: addressQ, counts: { spins: spins.length, deposits: deposits.length, withdrawals: withdrawals.length }, returned: merged.length },
      "feed/: built feed"
    );

    return res.json({ ok: true, items: merged, chainId });
  } catch (e) {
    logger.error(e, "feed/: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;