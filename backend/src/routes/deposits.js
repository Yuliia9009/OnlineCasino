import { Router } from "express";
import prisma from "../db.js";
import logger from "../utils/logger.js";
import { pickNetwork } from "../services/chain-resolver.js";
import { makeClients, parseDepositFromTx } from "../services/onchain.js";

const r = Router();

/* ============ CONFIG / UTILS ============ */

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID_DEFAULT || 11155111);

const toInt = (v, d, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return d;
  return max ? Math.min(n, max) : n;
};

const norm = (a) => (a ? a.toLowerCase() : a);
const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h || "");

/* ============ LIST (GET) ============ */
/**
 * GET /api/deposits?address=0x..&limit=&chainId=
 */
r.get("/", async (req, res) => {
  try {
    const address = norm(req.query.address);
    const chainId = toInt(req.query.chainId, DEFAULT_CHAIN_ID);
    const limit = toInt(req.query.limit, 50, 200);

    if (!address) {
      return res.status(400).json({ ok: false, error: "address_required" });
    }

    const items = await prisma.deposits.findMany({
      where: { player_address_norm: address, chain_id: chainId },
      orderBy: { timestamp_utc: "desc" },
      take: limit,
      select: {
        id: true,
        tx_hash: true,
        amount_wei: true,
        block_number: true,
        timestamp_utc: true,
        status: true,
      },
    });

    return res.json({ ok: true, items });
  } catch (e) {
    logger.error(e, "deposits/list: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/* ============ CONFIRM (POST) ============ */
/**
 * POST /api/deposits/confirm
 * Body: { txHash, expectedPlayer?, chainId? }
 * Call after a successful on-chain `deposit` tx.
 */
r.post("/confirm", async (req, res) => {
  try {
    const { txHash, expectedPlayer } = req.body || {};
    if (!isTxHash(txHash)) {
      logger.warn({ txHash }, "deposits/confirm: bad_tx_hash");
      return res.status(400).json({ ok: false, error: "bad_tx_hash" });
    }

    const net = pickNetwork(req); // { chainId, rpcUrl, contract, confirmations }
    const { provider, iface, contractAddr } = makeClients(net);

    logger.info({ txHash, chainId: net.chainId }, "deposits/confirm: parsing Deposit");

    // Parse Deposit(...) event from the tx
    const evt = await parseDepositFromTx({
      provider,
      iface,
      contractAddr,
      txHash,
      confirmations: Number(net.confirmations || 0),
    });

    // Normalize fields for DB types
    const chainIdBI = BigInt(net.chainId);
    const amountWeiStr = String(evt.amountWei);
    const blockNumberBI = BigInt(evt.blockNumber);
    const playerChecksum = evt.playerChecksum ?? evt.player;
    const playerNorm = evt.player;
    const txHashFinal = evt.txHash || txHash;

    if (expectedPlayer && expectedPlayer.toLowerCase() !== evt.player) {
      logger.warn(
        { txHash, expectedPlayer, actual: evt.player },
        "deposits/confirm: player_mismatch"
      );
      return res.status(409).json({ ok: false, error: "player_mismatch" });
    }

    // Idempotent insert (UNIQUE(tx_hash, chain_id))
    try {
      await prisma.deposits.create({
        data: {
          chain_id: chainIdBI,
          player_address: playerChecksum,          // checksum
          player_address_norm: playerNorm,         // lowercase
          amount_wei: amountWeiStr,
          tx_hash: txHashFinal,
          block_number: blockNumberBI,
          timestamp_utc: new Date(evt.timestampMs),
          status: "ok",
        },
      });
      logger.info({ txHash: txHashFinal, player: playerNorm }, "deposits/confirm: saved");
    } catch (_dbErr) {
      logger.info({ txHash: txHashFinal }, "deposits/confirm: already_confirmed");
      return res.json({ ok: true, alreadyConfirmed: true, saved: evt, chainId: net.chainId });
    }

    // --- Update players aggregates ---
    try {
      const key = { address_norm_chain_id: { address_norm: playerNorm, chain_id: chainIdBI } };
      const existing = await prisma.players.findUnique({ where: key });

      if (!existing) {
        // create new aggregate row
        await prisma.players.create({
          data: {
            address_checksum: playerChecksum,
            address_norm: playerNorm,
            chain_id: chainIdBI,
            total_spins: 0n,
            total_deposited_wei: amountWeiStr,
            total_bet_wei: "0",
            total_payout_wei: "0",
            total_withdrawn_wei: "0",
            net_wei: (0n - BigInt(amountWeiStr)).toString(), // payout+withdrawn - deposited - bet
          },
        });
      } else {
        const depOld = BigInt(existing.total_deposited_wei || "0");
        const betOld = BigInt(existing.total_bet_wei || "0");
        const payOld = BigInt(existing.total_payout_wei || "0");
        const wdrOld = BigInt(existing.total_withdrawn_wei || "0");

        const depNew = depOld + BigInt(amountWeiStr);
        const netNew = payOld + wdrOld - depNew - betOld;

        await prisma.players.update({
          where: key,
          data: {
            total_deposited_wei: depNew.toString(),
            net_wei: netNew.toString(),
            updated_at: new Date(),
          },
        });
      }
    } catch (aggErr) {
      logger.warn({ txHash: txHashFinal, err: aggErr?.message }, "deposits/confirm: players_aggregate_update_failed");
    }

    return res.status(201).json({ ok: true, saved: evt, chainId: net.chainId });
  } catch (e) {
    if (e.code === "chain_not_configured") {
      logger.error({ chainId: req.body?.chainId }, "deposits/confirm: chain_not_configured");
      return res.status(503).json({ ok: false, error: "chain_not_configured" });
    }
    logger.error(e, "deposits/confirm: unexpected_error");
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;