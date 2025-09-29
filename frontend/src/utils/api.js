import { ethers } from "ethers";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const API_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);

/* ---------- базовый fetch ---------- */
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/* ---------- admin ---------- */

export async function getSummaryStats(chainId = API_CHAIN_ID) {
  const q = new URLSearchParams({ chainId: String(chainId) });
  return request(`/api/stats/summary?${q.toString()}`);
}

// leaderboard top
export async function getLeaderboard(
  metric = "total_payout_wei",
  limit = 10,
  chainId = API_CHAIN_ID
) {
  const q = new URLSearchParams({
    metric,
    limit: String(limit),
    chainId: String(chainId),
  });
  return request(`/api/stats/leaderboard?${q.toString()}`);
}

// RTP window
export async function getRTP(window = "7d", chainId = API_CHAIN_ID) {
  const q = new URLSearchParams({ window, chainId: String(chainId) });
  const data = await request(`/api/stats/rtp?${q.toString()}`);

  // backend returns strings for *_wei; be defensive about field names
  const betWei = (data?.betWei ?? data?.bet_wei ?? "0").toString();
  const payoutWei = (data?.payoutWei ?? data?.payout_wei ?? "0").toString();
  const rtpPercent = Number(data?.RTP_percent ?? data?.rtp ?? 0);

  let betEthNum = 0;
  let payoutEthNum = 0;
  try {
    betEthNum = Number(ethers.formatEther(betWei));
    payoutEthNum = Number(ethers.formatEther(payoutWei));
  } catch (_) {}

  return {
    ok: data?.ok !== false,
    chainId: Number(data?.chainId ?? chainId),
    window: data?.window ?? window,
    rtpPercent,
    betWei,
    payoutWei,
    betEth: betEthNum,
    payoutEth: payoutEthNum,
    raw: data,
  };
}

/* ---------- публичные фиды ---------- */

// лента останніх спинів
export async function getFeed({ limit = 30, address, chainId = API_CHAIN_ID } = {}) {
  const q = new URLSearchParams({
    limit: String(limit),
    chainId: String(chainId),
    ...(address ? { address } : {}),
  });

  const path = address
    ? `/api/spins?${q.toString()}`
    : `/api/spins/recent?${q.toString()}`;

  const data = await request(path);
  return Array.isArray(data?.items) ? data.items : [];
}

// історія спинів конкретного гравця
export async function fetchHistory(address, chainId = API_CHAIN_ID) {
  const q = new URLSearchParams({ address, chainId: String(chainId) });
  const data = await request(`/api/spins?${q.toString()}`);
  return Array.isArray(data?.items) ? data.items : [];
}

/* ---------- БД ---------- */

// депозит -> /api/deposits/confirm
export async function apiConfirmDeposit({ txHash, address, chainId = API_CHAIN_ID }) {
  return request("/api/deposits/confirm", {
    method: "POST",
    body: JSON.stringify({
      txHash,
      expectedPlayer: address,
      chainId,
    }),
  });
}
// виведення -> /api/withdrawals/confirm
export async function apiConfirmWithdraw({ txHash, address, chainId = API_CHAIN_ID }) {
  return request("/api/withdrawals/confirm", {
    method: "POST",
    body: JSON.stringify({
      txHash,
      expectedPlayer: address,
      chainId,
    }),
  });
}

// спін -> /api/spins/confirm (best-effort)
export async function apiConfirmSpin({ txHash, address, chainId = API_CHAIN_ID }) {
  return request("/api/spins/confirm", {
    method: "POST",
    body: JSON.stringify({
      txHash,
      expectedPlayer: address,
      chainId,
    }),
  });
}

// один спін по txHash
export async function getSpinByTx(txHash, chainId = API_CHAIN_ID) {
  if (!txHash) throw new Error("txHash is required");
  const q = new URLSearchParams({ chainId: String(chainId) });
  return request(`/api/spins/by-tx/${txHash}?${q.toString()}`);
}

/* ---------- аліаси на випадок старих імпортів ---------- */
export const apiDeposit = apiConfirmDeposit;
export const apiWithdraw = apiConfirmWithdraw;
export const confirmDeposit = apiConfirmDeposit;
export const confirmWithdraw = apiConfirmWithdraw;
export const confirmSpin = apiConfirmSpin;

console.log("[api] BASE =", API_BASE, "CHAIN_ID =", API_CHAIN_ID);