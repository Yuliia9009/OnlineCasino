import dotenv from "dotenv";
dotenv.config();

import prisma from "../db.js";
import logger from "../utils/logger.js";

import { pickNetwork } from "../../services/chain-resolver.js";
import { makeClients } from "../../services/onchain.js";
import { SLOT_ABI } from "../../services/abi.js";
import { Interface } from "ethers";

import statsRoutes from "./routes/stats.js";
import playersRoutes from "./routes/players.js";
import spinsRoutes from "./routes/spins.js";
import depositsRoutes from "./routes/deposits.js";
import withdrawalsRoutes from "./routes/withdrawals.js";
import feedRoutes from "./routes/feed.js";

app.use("/api/feed", feedRoutes);

app.use("/api/stats", statsRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/spins", spinsRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);

// --- сеть по умолчанию (CHAIN_ID_DEFAULT из .env)
const net = pickNetwork({ query: {}, body: {} }); // { chainId, rpcUrl, contract, confirmations }
const { rpcUrl, contract, confirmations = 0 } = net;

const iface = new Interface(SLOT_ABI);
const { provider, contractAddr } = (() => {
  const { provider, contractAddr } = makeClients({ rpcUrl, contract });
  return { provider, contractAddr };
})();

const START_BLOCK = Number(process.env[`START_BLOCK_${net.chainId}`] || 0);
const CHUNK_SIZE = Number(process.env.INDEXER_CHUNK_SIZE || 2_000);
const POLL_INTERVAL_MS = Number(process.env.INDEXER_POLL_INTERVAL_MS || 8_000);

/** утилита: insert c уникальным ключом (tx_hash+chain_id) */
async function saveEvent(kind, data) {
  try {
    if (kind === "Deposit") {
      await prisma.deposits.create({ data });
    } else if (kind === "Withdraw") {
      await prisma.withdrawals.create({ data });
    } else if (kind === "SpinPlayed") {
      await prisma.spins.create({ data });
    }
    logger.info({ kind, tx: data.tx_hash }, "indexer: event saved");
  } catch (e) {
    if (e?.code === "P2002") {
      logger.debug({ kind, tx: data.tx_hash }, "indexer: duplicate event (skip)");
      return;
    }
    logger.error(e, `indexer: failed to save ${kind}`);
  }
}

/** разобрать один лог и сохранить */
async function handleLog(log) {
  if (log.address.toLowerCase() !== contractAddr.toLowerCase()) return;

  let parsed;
  try {
    parsed = iface.parseLog({ topics: log.topics, data: log.data });
  } catch {
    return; // не из нашего ABI
  }

  const name = parsed.name;
  const a = parsed.args;

  // подтверждения
  if (confirmations > 0) {
    const head = await provider.getBlockNumber();
    const got = Math.max(0, head - Number(log.blockNumber));
    if (got < confirmations) {
      logger.debug(
        { tx: log.transactionHash, need: confirmations, got },
        "indexer: not enough confirmations yet"
      );
      return;
    }
  }

  // таймстамп блока
  const block = await provider.getBlock(log.blockNumber);
  const tsMs = Number(block.timestamp) * 1000;

  if (name === "Deposit") {
    await saveEvent("Deposit", {
      chain_id: net.chainId,
      player_address_norm: String(a.player).toLowerCase(),
      address_checksum: String(a.player),
      amount_wei: a.amount?.toString?.() ?? "0",
      tx_hash: log.transactionHash,
      block_number: Number(log.blockNumber),
      timestamp_utc: new Date(tsMs),
      status: "ok",
    });
  } else if (name === "Withdraw") {
    await saveEvent("Withdraw", {
      chain_id: net.chainId,
      player_address_norm: String(a.player).toLowerCase(),
      address_checksum: String(a.player),
      amount_wei: a.amount?.toString?.() ?? "0",
      tx_hash: log.transactionHash,
      block_number: Number(log.blockNumber),
      timestamp_utc: new Date(tsMs),
      status: "ok",
    });
  } else if (name === "SpinPlayed") {
    const betWei = a.bet?.toString?.() ?? "0";
    const payoutWei = a.winAmount?.toString?.() ?? "0";
    const reels = Array.isArray(a.reels) ? Array.from(a.reels, Number) : [0, 0, 0];

    await saveEvent("SpinPlayed", {
      chain_id: net.chainId,
      player_address_norm: String(a.player).toLowerCase(),
      address_checksum: String(a.player),
      bet_wei: betWei,
      payout_wei: payoutWei,
      reel_1: reels[0],
      reel_2: reels[1],
      reel_3: reels[2],
      tx_hash: log.transactionHash,
      block_number: Number(log.blockNumber),
      timestamp_utc: new Date(tsMs),
    });
  }
}

/** бэκфилл */
async function backfill(fromBlock) {
  if (fromBlock < 0) fromBlock = 0;
  const latest = await provider.getBlockNumber();
  let start = fromBlock;
  logger.info({ fromBlock: start, latest }, "indexer: backfill start");

  while (start <= latest) {
    const to = Math.min(start + CHUNK_SIZE - 1, latest);
    const filter = { address: contractAddr, fromBlock: start, toBlock: to };

    try {
      const logs = await provider.getLogs(filter);
      logger.info({ from: start, to, count: logs.length }, "indexer: chunk fetched");
      for (const log of logs) {
        try {
          await handleLog(log);
        } catch (e) {
          logger.error(e, "indexer: handleLog failed during backfill");
        }
      }
    } catch (e) {
      logger.error({ from: start, to }, "indexer: getLogs failed");
      await new Promise((r) => setTimeout(r, 1500));
    }

    start = to + 1;
  }

  logger.info("indexer: backfill done");
}

/** подписка на новые события */
function subscribe() {
  const filter = { address: contractAddr };
  provider.on(filter, async (log) => {
    try {
      await handleLog(log);
    } catch (e) {
      logger.error(e, "indexer: handleLog failed on live log");
    }
  });
  logger.info({ chainId: net.chainId, contract: contractAddr }, "indexer: subscribed");
}

/** периодический догон головы */
function startPoller() {
  let lastChecked = 0;

  const tick = async () => {
    try {
      const head = await provider.getBlockNumber();
      if (lastChecked === 0) {
        lastChecked = START_BLOCK > 0 ? START_BLOCK - 1 : head;
      }

      if (head > lastChecked) {
        const from = lastChecked + 1;
        await backfill(from);
        lastChecked = head;
      }
    } catch (e) {
      logger.error(e, "indexer: poller error");
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  setTimeout(tick, POLL_INTERVAL_MS);
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "indexer: poller started");
}

/** graceful shutdown */
function setupShutdown() {
  const close = async (sig) => {
    try {
      logger.info({ sig }, "indexer: shutting down");
      provider.removeAllListeners();
      await prisma.$disconnect().catch(() => {});
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => close("SIGINT"));
  process.on("SIGTERM", () => close("SIGTERM"));
}

/** bootstrap */
(async () => {
  try {
    logger.info(
      { chainId: net.chainId, rpcUrl, contract: contractAddr, confirmations },
      "indexer: boot"
    );

    if (START_BLOCK >= 0) {
      logger.info({ start: START_BLOCK }, "indexer: backfill requested");
      await backfill(START_BLOCK);
    }

    subscribe();
    startPoller();
    setupShutdown();
  } catch (e) {
    logger.error(e, "indexer: fatal boot error");
    process.exit(1);
  }
})();