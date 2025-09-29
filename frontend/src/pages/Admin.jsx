import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  getSummaryStats,
  getLeaderboard,
  getFeed,
  getRTP,
  getSpinByTx,
  API_CHAIN_ID,
} from "../utils/api";

/* ===================== helpers ===================== */

const SYMBOLS = ["🍒", "🍋", "🍊", "⭐", "7️⃣"];
const mapSymbol = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? SYMBOLS[n % SYMBOLS.length] : "?";
};
const reelsToString = (item) => {
  const r1 = item.reel_1 ?? item.reels?.[0];
  const r2 = item.reel_2 ?? item.reels?.[1];
  const r3 = item.reel_3 ?? item.reels?.[2];
  if (r1 == null || r2 == null || r3 == null) return "";
  return `${mapSymbol(r1)} ${mapSymbol(r2)} ${mapSymbol(r3)}`;
};
const fmtEth = (wei) => {
  if (wei == null) return "-";
  try {
    return ethers.formatEther(wei.toString());
  } catch {
    return "0";
  }
};
const short = (s, n = 10) => (s ? `${s.slice(0, n)}…${s.slice(-4)}` : "—");
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/* ===================== Admin page ===================== */

export default function Admin() {
  const [tab, setTab] = useState("summary"); // summary | leaders | games | tx
  const [err, setErr] = useState("");

  // summary tab
  const [summary, setSummary] = useState(null);
  const [rtpWin, setRtpWin] = useState("24h"); // 24h | 7d | 30d
  const [rtp, setRtp] = useState(null);

  // leaders tab
  const [metric, setMetric] = useState("total_payout_wei"); // total_spins | total_bet_wei | total_payout_wei | net_wei
  const [limit, setLimit] = useState(10);
  const [leaders, setLeaders] = useState([]);

  // games tab
  const [recent, setRecent] = useState([]);
  const [gamesLimit, setGamesLimit] = useState(10);
  const [addrFilter, setAddrFilter] = useState("");

  // tx tab
  const [txHash, setTxHash] = useState("");
  const [txItem, setTxItem] = useState(null);
  const [addrItems, setAddrItems] = useState(null); // array of spins for address

  async function loadSummary() {
    const s = await getSummaryStats(API_CHAIN_ID);
    setSummary(s);
    const r = await getRTP(rtpWin, API_CHAIN_ID).catch(() => null);
    setRtp(r);
  }

  async function loadLeaders() {
    const lb = await getLeaderboard(metric, Number(limit) || 10, API_CHAIN_ID);
    setLeaders(lb?.top || []);
  }

  async function loadGames() {
    const addr = (addrFilter || "").trim().toLowerCase();
    const list = await getFeed({
      limit: Number(gamesLimit) || 10,
      ...(addr ? { address: addr } : {}),
      chainId: API_CHAIN_ID,
    });
    setRecent(Array.isArray(list) ? list : []);
  }

  async function loadAll() {
    try {
      setErr("");
      await Promise.all([loadSummary(), loadLeaders(), loadGames()]);
    } catch (e) {
      setErr(e?.message || String(e));
      // keep partial data if some requests succeeded
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload leaders when metric/limit changes
  useEffect(() => {
    loadLeaders().catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, limit]);

  // reload RTP when window changes
  useEffect(() => {
    getRTP(rtpWin, API_CHAIN_ID)
      .then(setRtp)
      .catch(() => setRtp(null));
  }, [rtpWin]);

  // reload games when filters change
  useEffect(() => {
    loadGames().catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesLimit]);

  async function handleFindTx(e) {
    e?.preventDefault?.();
    setTxItem(null);
    setAddrItems(null);
    setErr("");

    const raw = (txHash || "").trim();
    if (!raw) {
      setErr("Введіть tx-хеш або адресу гравця.");
      return;
    }

    try {
      if (TX_RE.test(raw)) {
        const item = await getSpinByTx(raw, API_CHAIN_ID);
        setTxItem(item);
      } else if (ADDRESS_RE.test(raw)) {
        const list = await getFeed({ limit: 20, address: raw.toLowerCase(), chainId: API_CHAIN_ID });
        setAddrItems(Array.isArray(list) ? list : []);
      } else {
        setErr("Невірний формат. Очікується tx-хеш (0x + 64 hex) або адреса (0x + 40 hex).");
      }
    } catch (e2) {
      setErr(e2?.message || String(e2));
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl">Адмін Панель</h1>
        <button
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
          onClick={loadAll}
        >
          Refresh
        </button>
        {err && <span className="text-red-400 ml-2">HTTP 500: {err}</span>}
      </div>

      {/* tabs */}
      <div className="flex gap-2">
        {[
          ["summary", "Статистика"],
          ["leaders", "Топ гравців"],
          ["games", "Останні ігри"],
          ["tx", "Перевірка Tx"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1 rounded ${tab === key ? "bg-gray-700" : "bg-gray-800 hover:bg-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SUMMARY */}
      {tab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard title="Всього гравців" value={summary?.totalPlayers ?? 0} />
            <StatCard title="Всього ігор" value={summary?.totalSpins ?? 0} />
            <StatCard
              title="Баланс казино (депозити)"
              value={
                summary?.totals
                  ? `${fmtEth(summary.totals.totalDepositedWei)} ETH`
                  : "—"
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <StatCard title="Ставки (ETH)" value={fmtEth(summary?.totals?.totalBetWei)} />
            <StatCard title="Виплати (ETH)" value={fmtEth(summary?.totals?.totalPayoutWei)} />
            <StatCard title="Виводи (ETH)" value={fmtEth(summary?.totals?.totalWithdrawnWei)} />
            <StatCard title="Net (ETH)" value={fmtEth(summary?.totals?.netWei)} />
          </div>

          <div className="bg-gray-800 p-4 rounded">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-gray-300">RTP</div>
              <select
                value={rtpWin}
                onChange={(e) => setRtpWin(e.target.value)}
                className="bg-gray-900 rounded px-2 py-1"
              >
                <option value="24h">24h</option>
                <option value="7d">7d</option>
                <option value="30d">30d</option>
              </select>
            </div>
            <div className="text-2xl font-semibold">
              {rtp?.rtpPercent != null ? `${rtp.rtpPercent}%` : "—"}
            </div>
            {rtp?.count != null && (
              <div className="text-sm text-gray-400">
                Ігор: {rtp.count}, Ставок: {fmtEth(rtp.betWei)}, Виплат: {fmtEth(rtp.payoutWei)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEADERS */}
      {tab === "leaders" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Метрика:</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="bg-gray-900 rounded px-2 py-1"
            >
              <option value="total_spins">total_spins</option>
              <option value="total_bet_wei">total_bet_wei</option>
              <option value="total_payout_wei">total_payout_wei</option>
              <option value="net_wei">net_wei</option>
            </select>

            <label className="text-sm text-gray-400 ml-3">Ліміт:</label>
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="bg-gray-900 rounded px-2 py-1 w-20"
              type="number"
              min={1}
              max={100}
            />
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="py-2 pr-4">Адреса</th>
                  <th className="py-2 pr-4">Ігор</th>
                  <th className="py-2 pr-4">Bet (ETH)</th>
                  <th className="py-2 pr-4">Payout (ETH)</th>
                  <th className="py-2 pr-4">Net (ETH)</th>
                </tr>
              </thead>
              <tbody>
                {leaders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-gray-400">
                      Даних немає
                    </td>
                  </tr>
                )}
                {leaders.map((p) => (
                  <tr key={p.address_checksum} className="border-t border-gray-700">
                    <td className="py-2 pr-4">{p.address_checksum}</td>
                    <td className="py-2 pr-4 text-center">{p.total_spins}</td>
                    <td className="py-2 pr-4 text-center">{fmtEth(p.total_bet_wei)}</td>
                    <td className="py-2 pr-4 text-center">{fmtEth(p.total_payout_wei)}</td>
                    <td className="py-2 pr-4 text-center">{fmtEth(p.net_wei)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GAMES */}
      {tab === "games" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Ліміт:</label>
            <input
              value={gamesLimit}
              onChange={(e) => setGamesLimit(e.target.value)}
              className="bg-gray-900 rounded px-2 py-1 w-20"
              type="number"
              min={1}
              max={200}
            />
            <label className="text-sm text-gray-400 ml-3">Адреса:</label>
            <input
              value={addrFilter}
              onChange={(e) => setAddrFilter(e.target.value)}
              placeholder="0x… (optional)"
              className="bg-gray-900 rounded px-2 py-1 w-[340px]"
            />
            <button
              className="ml-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
              onClick={loadGames}
            >
              Завантажити
            </button>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="py-2 pr-4">Час</th>
                  <th className="py-2 pr-4">Гравець</th>
                  <th className="py-2 pr-4">Ставка (ETH)</th>
                  <th className="py-2 pr-4">Виплата (ETH)</th>
                  <th className="py-2 pr-4">Ролики</th>
                  <th className="py-2 pr-4">Tx</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-gray-400">
                      Спінів не знайдено
                    </td>
                  </tr>
                )}
                {recent.map((i) => (
                  <tr key={i.id ?? i.tx_hash} className="border-t border-gray-700">
                    <td className="py-2 pr-4">
                      {new Date(i.timestamp_utc ?? Date.now()).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      {i.player_address_norm ?? i.address_checksum ?? i.player}
                    </td>
                    <td className="py-2 pr-4 text-center">{fmtEth(i.bet_wei)}</td>
                    <td className="py-2 pr-4 text-center">{fmtEth(i.payout_wei)}</td>
                    <td className="py-2 pr-4 text-center">{reelsToString(i)}</td>
                    <td className="py-2 pr-4 text-xs">{i.tx_hash ? short(i.tx_hash) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TX CHECK */}
      {tab === "tx" && (
        <div className="space-y-3">
          <form onSubmit={handleFindTx} className="flex items-center gap-2">
            <input
              className="bg-gray-900 rounded px-3 py-2 flex-1"
              placeholder="Вставте tx-хеш (0x+64) або адресу (0x+40)"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              inputMode="text"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500">
              Перевірити
            </button>
          </form>
          <div className="text-xs text-gray-500">Підказка: вставте tx-хеш (0x + 64 hex) або адресу гравця (0x + 40 hex).</div>

          {txItem && (
            <div className="bg-gray-800 p-4 rounded">
              <div className="text-gray-400 text-sm mb-2">
                Tx: {txItem.tx_hash ? short(txItem.tx_hash, 18) : "—"}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-gray-400">Час:</span> {new Date(txItem.timestamp_utc ?? Date.now()).toLocaleString()}</div>
                <div><span className="text-gray-400">Адреса:</span> {txItem.player_address ?? txItem.player_address_norm}</div>
                <div><span className="text-gray-400">Block:</span> {txItem.block_number ?? "—"}</div>
                <div><span className="text-gray-400">Bet:</span> {fmtEth(txItem.bet_wei)} ETH</div>
                <div><span className="text-gray-400">Payout:</span> {fmtEth(txItem.payout_wei)} ETH</div>
                <div><span className="text-gray-400">Ролики:</span> {reelsToString(txItem)}</div>
              </div>
            </div>
          )}
          {Array.isArray(addrItems) && (
            <div className="bg-gray-800 p-4 rounded overflow-auto">
              <div className="text-sm text-gray-400 mb-2">Останні спіни адреси ({addrItems.length}):</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="py-2 pr-4">Час</th>
                    <th className="py-2 pr-4">Ставка (ETH)</th>
                    <th className="py-2 pr-4">Виплата (ETH)</th>
                    <th className="py-2 pr-4">Ролики</th>
                    <th className="py-2 pr-4">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {addrItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-gray-400">Нічого не знайдено</td>
                    </tr>
                  )}
                  {addrItems.map((i) => (
                    <tr key={i.id ?? i.tx_hash} className="border-t border-gray-700">
                      <td className="py-2 pr-4">{new Date(i.timestamp_utc ?? Date.now()).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-center">{fmtEth(i.bet_wei)}</td>
                      <td className="py-2 pr-4 text-center">{fmtEth(i.payout_wei)}</td>
                      <td className="py-2 pr-4 text-center">{reelsToString(i)}</td>
                      <td className="py-2 pr-4 text-xs">{i.tx_hash ? short(i.tx_hash) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===================== UI bits ===================== */

function StatCard({ title, value }) {
  return (
    <div className="bg-gray-800 p-4 rounded">
      <div className="text-gray-400 text-sm">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}