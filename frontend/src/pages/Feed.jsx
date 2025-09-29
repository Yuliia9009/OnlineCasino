import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { getFeed } from "../utils/api";

function short(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

const SYMBOLS = ["🍒", "🍋", "🍊", "⭐", "7️⃣"];
const reelsToString = (r1, r2, r3) => {
  const map = (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
      ? SYMBOLS[v % SYMBOLS.length]
      : "?";
  if (r1 === undefined || r2 === undefined || r3 === undefined) return "";
  return `${map(Number(r1))} ${map(Number(r2))} ${map(Number(r3))}`;
};

export default function Feed() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const list = await getFeed(30);
      setItems(Array.isArray(list) ? list : []);
      setErr("");
    } catch (e) {
      setErr(e.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    return (Array.isArray(items) ? items : []).map((i, idx) => {
      const id =
        i.id ?? i.tx_hash ?? `${i.player_address_norm || i.player}-${i.timestamp_utc || idx}`;
      const when = new Date(i.timestamp_utc ?? i.time ?? Date.now()).toLocaleString();

      const player = i.player_address_norm ?? i.address_checksum ?? i.player ?? "";
      const betWei = i.bet_wei ?? i.betWei ?? i.bet ?? null;
      const payoutWei = i.payout_wei ?? i.payoutWei ?? i.win ?? null;

      const betEth = betWei != null ? ethers.formatEther(betWei.toString()) : null;
      const payoutEth = payoutWei != null ? ethers.formatEther(payoutWei.toString()) : null;

      const reelsStr =
        i.result?.join?.(" ") ??
        reelsToString(i.reel_1, i.reel_2, i.reel_3);

      return {
        id,
        when,
        player,
        reelsStr,
        betEth,
        payoutEth,
        isWin: payoutEth && Number(payoutEth) > 0,
      };
    });
  }, [items]);

  if (err) {
    return <div className="text-red-400">Помилка завантаження: {err}</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl">Історія активності</h2>
        {loading && <span className="text-sm text-gray-400">оновлення…</span>}
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="text-gray-400">Активність відсутня</div>
        )}

        {rows.map((r) => (
          <div key={r.id} className="bg-gray-800 p-3 rounded flex justify-between">
            <div>
              <div className="text-sm text-gray-400">{r.when}</div>
              <div className="font-medium">
                Гравець {short(r.player)} зробив спін {r.reelsStr && (
                  <span>({r.reelsStr})</span>
                )}
              </div>
            </div>
            <div className="text-right">
              {r.isWin ? (
                <div className="text-green-400">Виграш</div>
              ) : (
                <div className="text-gray-300">Ставка</div>
              )}
              {r.betEth != null && (
                <div className="text-xs text-gray-400">Bet: {r.betEth} ETH</div>
              )}
              {r.payoutEth != null && (
                <div className="text-xs text-gray-400">Payout: {r.payoutEth} ETH</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}