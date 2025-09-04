import { ethers } from "ethers";
import { SLOT_ABI } from "./abi.js";
import logger from "../utils/logger.js";

// простой кэш интерфейса, чтобы не пересоздавать на каждый запрос
let _iface = null;
function getIface() {
  if (!_iface) _iface = new ethers.Interface(SLOT_ABI);
  return _iface;
}

/**
 * Создаёт клиентов для работы с сетью:
 * - provider: JsonRpcProvider
 * - iface:    Interface по ABI (для парсинга логов)
 * - contractAddr: checksummed адрес контракта
 */
export function makeClients({ rpcUrl, contract }) {
  if (!rpcUrl || !contract) {
    const err = new Error("rpc_or_contract_missing");
    err.code = "config_missing";
    throw err;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const iface = getIface();
  const contractAddr = ethers.getAddress(contract);

  logger.debug({ rpcUrl, contractAddr }, "onchain.makeClients: created");
  return { provider, iface, contractAddr };
}

/** Получить timestamp блока в миллисекундах */
async function getBlockTimestampMs(provider, blockNumber) {
  const block = await provider.getBlock(blockNumber);
  if (!block) {
    const err = new Error("block_not_found");
    err.code = "block_not_found";
    throw err;
  }
  return Number(block.timestamp) * 1000;
}

/** Найти лог по названию события */
function findLogByEvent({ receipt, iface, contractAddr, eventName }) {
  const ev = iface.getEvent(eventName);
  const topic0 = ev.topicHash;

  const log = receipt.logs?.find(
    (l) => l.address?.toLowerCase() === contractAddr.toLowerCase() && l.topics?.[0] === topic0
  );
  return log ?? null;
}

/** Общая обвязка: подтянуть receipt (с опциональным ожиданием подтверждений) */
async function getReceiptWithConfirmations(provider, txHash, confirmations = 0) {
  logger.debug({ txHash, confirmations }, "onchain.getReceipt: fetching");
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    const err = new Error("tx_not_found");
    err.code = "tx_not_found";
    throw err;
  }
  if (confirmations > 0) {
    const head = await provider.getBlockNumber();
    const got = Math.max(0, head - Number(receipt.blockNumber));
    if (got < confirmations) {
      const err = new Error(`not_enough_confirmations: need=${confirmations}, got=${got}`);
      err.code = "not_enough_confirmations";
      err.details = { need: confirmations, got };
      throw err;
    }
  }
  return receipt;
}

/**
 * Парсер SpinResult
 * Ожидаем в ABI:
 *   event SpinResult(address player, uint256 bet, uint256 payout, uint256[3] reels, uint256 rnd);
 * Допускаем синонимы полей.
 */
export async function parseSpinFromTx({ provider, iface, contractAddr, txHash, confirmations = 0 }) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    const err = new Error("bad_tx_hash");
    err.code = "bad_tx_hash";
    throw err;
  }

  const receipt = await getReceiptWithConfirmations(provider, txHash, confirmations);
  const log = findLogByEvent({ receipt, iface, contractAddr, eventName: "SpinResult" });
  if (!log) {
    const err = new Error("spin_event_not_found");
    err.code = "event_not_found";
    throw err;
  }

  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  const a = parsed.args;

  const playerChecksum = String(a.player);
  const player = playerChecksum.toLowerCase();

  const betWei = a.bet?.toString?.() ?? a.betWei?.toString?.() ?? "0";
  const payoutWei = a.payout?.toString?.() ?? a.payoutWei?.toString?.() ?? "0";

  let reels = [];
  if (Array.isArray(a.reels)) {
    reels = Array.from(a.reels, (x) => Number(x));
  } else if (a.reel_1 !== undefined && a.reel_2 !== undefined && a.reel_3 !== undefined) {
    reels = [Number(a.reel_1), Number(a.reel_2), Number(a.reel_3)];
  }

  const rnd = a.rnd?.toString?.() ?? null;

  const blockNumber = Number(receipt.blockNumber);
  const timestampMs = await getBlockTimestampMs(provider, blockNumber);

  logger.info({ txHash, player, blockNumber }, "onchain.parseSpin: parsed");
  return {
    kind: "spin",
    txHash: receipt.transactionHash,
    blockNumber,
    timestampMs,
    player,
    playerChecksum,
    betWei: String(betWei),
    payoutWei: String(payoutWei),
    reels,
    rnd,
  };
}

/** Парсер Deposit(address player, uint256 amount) */
export async function parseDepositFromTx({ provider, iface, contractAddr, txHash, confirmations = 0 }) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    const err = new Error("bad_tx_hash");
    err.code = "bad_tx_hash";
    throw err;
  }

  const receipt = await getReceiptWithConfirmations(provider, txHash, confirmations);
  const log = findLogByEvent({ receipt, iface, contractAddr, eventName: "Deposit" });
  if (!log) {
    const err = new Error("deposit_event_not_found");
    err.code = "event_not_found";
    throw err;
  }

  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  const a = parsed.args;

  const playerChecksum = String(a.player);
  const player = playerChecksum.toLowerCase();
  const amountWei = a.amount?.toString?.() ?? a.value?.toString?.() ?? "0";

  const blockNumber = Number(receipt.blockNumber);
  const timestampMs = await getBlockTimestampMs(provider, blockNumber);

  logger.info({ txHash, player, blockNumber, amountWei }, "onchain.parseDeposit: parsed");
  return {
    kind: "deposit",
    txHash: receipt.transactionHash,
    blockNumber,
    timestampMs,
    player,
    playerChecksum,
    amountWei: String(amountWei),
  };
}

/** Парсер Withdraw(address player, uint256 amount) */
export async function parseWithdrawFromTx({ provider, iface, contractAddr, txHash, confirmations = 0 }) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    const err = new Error("bad_tx_hash");
    err.code = "bad_tx_hash";
    throw err;
  }

  const receipt = await getReceiptWithConfirmations(provider, txHash, confirmations);
  const log = findLogByEvent({ receipt, iface, contractAddr, eventName: "Withdraw" });
  if (!log) {
    const err = new Error("withdraw_event_not_found");
    err.code = "event_not_found";
    throw err;
  }

  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  const a = parsed.args;

  const playerChecksum = String(a.player);
  const player = playerChecksum.toLowerCase();
  const amountWei = a.amount?.toString?.() ?? a.value?.toString?.() ?? "0";

  const blockNumber = Number(receipt.blockNumber);
  const timestampMs = await getBlockTimestampMs(provider, blockNumber);

  logger.info({ txHash, player, blockNumber, amountWei }, "onchain.parseWithdraw: parsed");
  return {
    kind: "withdraw",
    txHash: receipt.transactionHash,
    blockNumber,
    timestampMs,
    player,
    playerChecksum,
    amountWei: String(amountWei),
  };
}