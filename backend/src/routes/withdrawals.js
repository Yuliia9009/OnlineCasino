import { Router } from "express";
import prisma from "../db.js";
import logger from "../utils/logger.js";
import { pickNetwork } from "../services/chain-resolver.js";
import { makeClients, parseWithdrawFromTx } from "../services/onchain.js";

const r = Router();

/* ========================= УТИЛИТЫ ========================= */
const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);
const toInt = (v, d, max) => {
  const n = Number(v);
  return !Number.isFinite(n) || n <= 0 ? d : max ? Math.min(n, max) : n;
};
const norm = (a) => (a ? a.toLowerCase() : a);
const isTxHash = (h) => typeof h === "string" && /^0x[0-9a-fA-F]{64}$/.test(h);

// best-effort обновление агрегатов игрока в таблице players
async function bestEffortUpdatePlayersAggregate(evt, chainId) {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.players.findFirst({
        where: { address_norm: evt.player, chain_id: chainId },
        select: {
          id: true,
          address_checksum: true,
          total_spins: true,
          total_deposited_wei: true,
          total_bet_wei: true,
          total_payout_wei: true,
          total_withdrawn_wei: true,
          net_wei: true,
        },
      });

      const add = (a, b) => (BigInt(a ?? "0") + BigInt(b ?? "0")).toString();

      if (existing) {
        await tx.players.update({
          where: { id: existing.id },
          data: {
            total_withdrawn_wei: add(existing.total_withdrawn_wei, evt.amountWei),
            // net = payout + withdrawn - deposited - bet → при выводе увеличиваем net
            net_wei: add(existing.net_wei, evt.amountWei),
            address_checksum: existing.address_checksum || (evt.playerChecksum ?? evt.player),
          },
        });
      } else {
        await tx.players.create({
          data: {
            address_checksum: evt.playerChecksum ?? evt.player,
            address_norm: evt.player,
            chain_id: chainId,
            total_spins: 0,
            total_deposited_wei: "0",
            total_bet_wei: "0",
            total_payout_wei: "0",
            total_withdrawn_wei: String(evt.amountWei),
            net_wei: String(evt.amountWei),
          },
        });
      }
    });
  } catch (aggErr) {
    logger.warn({ txHash: evt.txHash, err: aggErr?.message },
      "withdraw.confirm: players aggregate update failed");
  }
}

/* ========================= РОУТЫ ========================= */

// GET /api/withdrawals?address=0x..&limit=&chainId=
r.get("/", async (req, res) => {
  try {
    const address = norm(req.query.address);
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 50, 200);

    if (!address) return res.status(400).json({ ok: false, error: "address_required" });

    const items = await prisma.withdrawals.findMany({
      where: { player_address_norm: address, chain_id: chainId },
      orderBy: { timestamp_utc: "desc" },
      take: limit,
      select: {
        id: true,
        tx_hash: true,
        player_address: true,
        amount_wei: true,
        block_number: true,
        timestamp_utc: true,
        status: true,
      },
    });

    res.json({ ok: true, items });
  } catch (e) {
    logger.error(e, "withdrawals/list: unexpected");
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/withdrawals/recent?chainId=&limit=
r.get("/recent", async (req, res) => {
  try {
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 50, 200);

    const items = await prisma.withdrawals.findMany({
      where: { chain_id: chainId },
      orderBy: { timestamp_utc: "desc" },
      take: limit,
      select: {
        id: true,
        tx_hash: true,
        player_address: true,
        amount_wei: true,
        block_number: true,
        timestamp_utc: true,
        status: true,
      },
    });

    res.json({ ok: true, items });
  } catch (e) {
    logger.error(e, "withdrawals/recent: unexpected");
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/withdrawals/by-tx/:txHash
r.get("/by-tx/:txHash", async (req, res) => {
  try {
    const txHash = req.params.txHash;
    if (!isTxHash(txHash)) {
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    const withdrawal = await prisma.withdrawals.findFirst({
      where: { tx_hash: txHash },
      select: {
        id: true,
        tx_hash: true,
        player_address: true,
        amount_wei: true,
        block_number: true,
        timestamp_utc: true,
        status: true,
        chain_id: true,
      },
    });

    if (!withdrawal) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    res.json({ ok: true, withdrawal });
  } catch (e) {
    logger.error(e, "withdrawals/by-tx: unexpected");
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/withdrawals/confirm
// Тело: { txHash, expectedPlayer?, chainId? }
r.post("/confirm", async (req, res) => {
  const startedAt = Date.now();

  try {
    const { txHash, expectedPlayer } = req.body || {};

    // 1) базовая валидация
    if (!isTxHash(txHash)) {
      logger.warn({ txHash }, "withdraw.confirm: bad or missing txHash");
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    // 2) сеть + клиенты (берём chainId из body/query или CHAIN_ID_DEFAULT)
    const net = pickNetwork(req); // { chainId, rpcUrl, contract, confirmations }
    const { provider, iface, contractAddr } = makeClients(net);

    logger.info(
      { txHash, chainId: net.chainId, contract: contractAddr },
      "withdraw.confirm: parsing tx"
    );

    // 3) распарсить событие Withdraw(...) из транзакции с учётом подтверждений
    // { txHash, player, playerChecksum?, amountWei, blockNumber, timestampMs }
    const evt = await parseWithdrawFromTx({ provider, iface, contractAddr, txHash, confirmations: net.confirmations });

    // 4) сверка ожидаемого адреса (если фронт прислал expectedPlayer)
    if (expectedPlayer && expectedPlayer.toLowerCase() !== evt.player) {
      logger.warn(
        { txHash, expectedPlayer, actual: evt.player },
        "withdraw.confirm: player mismatch"
      );
      return res.status(409).json({ ok: false, error: "player_mismatch" });
    }

    // 5) идемпотентная запись (UNIQUE(tx_hash, chain_id))
    try {
      await prisma.withdrawals.create({
        data: {
          chain_id: net.chainId,
          player_address: evt.playerChecksum ?? evt.player, // сохраняем красивый адрес
          player_address_norm: evt.player, // и нормализованный (lowercase)
          amount_wei: evt.amountWei,
          tx_hash: evt.txHash,
          block_number: Number(evt.blockNumber),
          timestamp_utc: new Date(Number(evt.timestampMs || 0)),
          status: "ok",
        },
      });
      logger.info(
        { txHash: evt.txHash, player: evt.player, chainId: net.chainId },
        "withdraw.confirm: saved"
      );
      // 5.1) Обновить агрегаты игрока в players (best-effort)
      await bestEffortUpdatePlayersAggregate(evt, net.chainId);
    } catch (dbErr) {
      // дубликат: запись уже есть — считаем операцию подтверждённой
      if (dbErr?.code === "P2002") {
        logger.info(
          { txHash: evt.txHash, chainId: net.chainId, detail: dbErr.meta },
          "withdraw.confirm: already confirmed (duplicate)"
        );
        await bestEffortUpdatePlayersAggregate(evt, net.chainId);
        return res.json({ ok: true, alreadyConfirmed: true, saved: evt, chainId: net.chainId });
      }
      logger.error(dbErr, "withdraw.confirm: db insert failed");
      return res.status(500).json({ ok: false, error: "db_insert_failed" });
    }

    // 6) финальный ответ
    return res.json({
      ok: true,
      saved: evt,
      chainId: net.chainId,
      tookMs: Date.now() - startedAt,
    });
  } catch (e) {
    if (e?.code === "chain_not_configured") {
      logger.error({ chainId: req.body?.chainId }, "withdraw.confirm: chain not configured");
      return res.status(503).json({ ok: false, error: "chain_not_configured" });
    }
    logger.error(e, "withdraw.confirm: unexpected error");
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
});

export default r;