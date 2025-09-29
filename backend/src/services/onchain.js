import { ethers } from "ethers";
import { SLOT_ABI } from "./abi.js";
import logger from "../utils/logger.js";

// кэш интерфейса ABI
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

  // приведём адрес к checksum и сразу кинем понятную ошибку при кривом адресе
  let contractAddr;
  try {
    contractAddr = ethers.getAddress(contract);
  } catch {
    const err = new Error("bad_contract_address");
    err.code = "config_bad_address";
    throw err;
  }

  logger.debug({ rpcUrl, contractAddr }, "onchain.makeClients: created");
  return { provider, iface, contractAddr };
}

/** timestamp блока в миллисекундах */
async function getBlockTimestampMs(provider, blockNumber) {
  const block = await provider.getBlock(blockNumber);
  if (!block) {
    const err = new Error("block_not_found");
    err.code = "block_not_found";
    throw err;
  }
  return Number(block.timestamp) * 1000;
}

/** найти лог по названию события */
function findLogByEvent({ receipt, iface, contractAddr, eventName }) {
  const ev = iface.getEvent(eventName);
  const topic0 = ev.topicHash;
  return (
    receipt.logs?.find(
      (l) =>
        l.address?.toLowerCase() === contractAddr.toLowerCase() &&
        l.topics?.[0] === topic0
    ) ?? null
  );
}

/** найти первый лог по любому из нескольких событий */
function findLogByAnyEvent({ receipt, iface, contractAddr, eventNames = [] }) {
  for (const name of eventNames) {
    const log = findLogByEvent({ receipt, iface, contractAddr, eventName: name });
    if (log) return { log, name };
  }
  return { log: null, name: null };
}

/** подтянуть receipt (с ожиданием подтверждений при необходимости) */
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
 * Парсер спина.
 * Поддерживает оба варианта:
 *  - SpinPlayed(address player, uint bet, uint[3] reels, uint winAmount, ...)
 *  - SpinResult(address player, uint bet, uint payout, uint[3] reels, ...)
 */
export async function parseSpinFromTx({
  provider,
  iface,
  contractAddr,
  txHash,
  confirmations = 0,
}) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    const err = new Error("bad_tx_hash");
    err.code = "bad_tx_hash";
    throw err;
  }

  const receipt = await getReceiptWithConfirmations(provider, txHash, confirmations);

  // Попробуем найти событие по любому имени
  const { log, name } = findLogByAnyEvent({
    receipt,
    iface,
    contractAddr,
    eventNames: ["SpinPlayed", "SpinResult"],
  });
  if (!log) {
    const err = new Error("spin_event_not_found");
    err.code = "event_not_found";
    throw err;
  }

  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  const a = parsed.args;

  // адрес игрока
  const playerChecksum = String(a.player);
  const player = playerChecksum.toLowerCase();

  // ставка
  const betWei =
    a.bet !== undefined
      ? String(a.bet)
      : a.betWei !== undefined
      ? String(a.betWei)
      : a.amountBet !== undefined
      ? String(a.amountBet)
      : "0";

  // выплата: в SpinPlayed поле называется winAmount, в SpinResult — payout
  const payoutWei =
    a.winAmount !== undefined
      ? String(a.winAmount)
      : a.payout !== undefined
      ? String(a.payout)
      : a.payoutWei !== undefined
      ? String(a.payoutWei)
      : "0";

  // барабаны
  let reels = [];
  if (Array.isArray(a.reels)) {
    reels = Array.from(a.reels, (x) => Number(x));
  } else if (
    a.reel_1 !== undefined &&
    a.reel_2 !== undefined &&
    a.reel_3 !== undefined
  ) {
    reels = [Number(a.reel_1), Number(a.reel_2), Number(a.reel_3)];
  }

  // дополнительные поля, если есть (rnd/timestamp и т.п.) — не критично
  const rnd = a.rnd !== undefined ? String(a.rnd) : null;

  const blockNumber = Number(receipt.blockNumber);
  const timestampMs = await getBlockTimestampMs(provider, blockNumber);

  logger.info(
    { txHash, player, blockNumber, betWei, payoutWei, event: name },
    "onchain.parseSpin: parsed"
  );
  return {
    kind: "spin",
    event: name,
    txHash: String(receipt.transactionHash),
    blockNumber,
    timestampMs,
    player,
    playerChecksum,
    betWei,
    payoutWei,
    reels,
    rnd,
  };
}

/** Парсер Deposit(address player, uint256 amount) */
export async function parseDepositFromTx({
  provider,
  iface,
  contractAddr,
  txHash,
  confirmations = 0,
}) {
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
  const amountWei =
    a.amount !== undefined
      ? String(a.amount)
      : a.value !== undefined
      ? String(a.value)
      : "0";

  const blockNumber = Number(receipt.blockNumber);
  const timestampMs = await getBlockTimestampMs(provider, blockNumber);

  logger.info({ txHash, player, blockNumber, amountWei }, "onchain.parseDeposit: parsed");
  return {
    kind: "deposit",
    txHash: String(receipt.transactionHash),
    blockNumber,
    timestampMs,
    player,
    playerChecksum,
    amountWei,
  };
}

/** Парсер Withdraw(address player, uint256 amount) */
export async function parseWithdrawFromTx({
  provider,
  iface,
  contractAddr,
  txHash,
  confirmations = 0,
}) {
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
  const amountWei =
    a.amount !== undefined
      ? String(a.amount)
      : a.value !== undefined
      ? String(a.value)
      : "0";

  const blockNumber = Number(receipt.blockNumber);
  const timestampMs = await getBlockTimestampMs(provider, blockNumber);

  logger.info({ txHash, player, blockNumber, amountWei }, "onchain.parseWithdraw: parsed");
  return {
    kind: "withdraw",
    txHash: String(receipt.transactionHash),
    blockNumber,
    timestampMs,
    player,
    playerChecksum,
    amountWei,
  };
}