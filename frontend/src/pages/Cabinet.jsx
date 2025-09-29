import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Reel from "../components/Reel";
import Balance from "../components/Balance";
import Result from "../components/Result";

import { getBalance, spinSlot, getSpinPrice } from "../utils/web3";
import { fetchHistory as fetchHistoryFromApi, apiConfirmSpin, getSpinByTx } from "../utils/api";
import { ethers } from "ethers";

export default function Cabinet({ address }) {
  const [balance, setBalance] = useState("0");
  const [bet, setBet] = useState("0");
  const [priceLoaded, setPriceLoaded] = useState(false);
  const [symbols, setSymbols] = useState(["🍒", "🍒", "🍒"]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");
  const [frozen, setFrozen] = useState([false, false, false]);

  const symbolsList = ["🍒", "🍋", "🍊", "⭐", "7️⃣"];

  useEffect(() => {
    if (!address) return;
    (async () => {
      try {
        const [b, hApi, p] = await Promise.all([
          getBalance(address).catch(() => "0"),
          fetchHistoryFromApi(address).catch(() => []),
          getSpinPrice().catch(() => null),
        ]);

        setBalance(b);
        const h = Array.isArray(hApi) ? hApi : (Array.isArray(hApi?.items) ? hApi.items : []);
        setHistory(h);
        if (p != null) setBet(String(p));
        setPriceLoaded(true);
      } catch (e) {
        console.error("[Cabinet] init error:", e);
        setError(e.message || "Помилка ініціалізації");
      }
    })();
  }, [address]);

  function toggleFreeze(index) {
    if (spinning) return;
    const countFrozen = frozen.filter((f) => f).length;
    if (!frozen[index] && countFrozen >= 2) return;

    const betNum = Number(bet) || 0;
    const cost = betNum * Math.pow(2, countFrozen);
    if (!frozen[index] && parseFloat(balance) < cost) {
      setError("Недостатньо коштів для заморозки");
      return;
    }

    setBalance((prev) => (!frozen[index] ? (parseFloat(prev) - cost).toFixed(5) : prev));
    const next = [...frozen];
    next[index] = !next[index];
    setFrozen(next);
    setError("");
  }

  async function handleSpin() {
    setError("");
    if (spinning) return;

    const betNum = parseFloat(bet) || 0;
    if ((Number(balance) || 0) < betNum) {
      setError("Недостатньо коштів для ставки");
      return;
    }

    setSpinning(true);
    setResult(null);

    let animationDoneResolve;
    const animationDone = new Promise((r) => (animationDoneResolve = r));

    try {
      const res = await spinSlot();
      const txHash = res?.txHash;

      let iter = 0;
      const baseResultFromTx = Array.isArray(res?.result) ? res.result : symbols;
      let finalResult = baseResultFromTx;

      const interval = setInterval(() => {
        setSymbols((prev) =>
          prev.map((s, idx) => (frozen[idx] ? s : symbolsList[(iter + idx + 1) % symbolsList.length])),
        );
        iter++;
        if (iter > 12) {
          clearInterval(interval);

          finalResult = baseResultFromTx.map((s, idx) => (frozen[idx] ? symbols[idx] : s));
          setSymbols(finalResult);
          setSpinning(false);
          setFrozen([false, false, false]);
          animationDoneResolve && animationDoneResolve();
        }
      }, 80);

      let confirmed = null;
      if (txHash) {
        try {
          await apiConfirmSpin({ txHash, address }).catch(() => { });
          for (let i = 0; i < 8; i++) {
            try {
              const r = await getSpinByTx(txHash);
              if (r?.item) {
                confirmed = r.item;
                break;
              }
            } catch { }
            await new Promise((r) => setTimeout(r, 800));
          }
        } catch (e) {
          console.warn("[spin] confirm failed:", e?.message || e);
        }
      }

      if (confirmed) {
        await animationDone;
        try {
          const reels = [confirmed.reel_1, confirmed.reel_2, confirmed.reel_3];
          const fromIdx = (i) => symbolsList[i] ?? "❓";
          const confirmedSymbols = reels.map(fromIdx);

          const winEth = (() => {
            try {
              return ethers.formatEther(BigInt(confirmed.payout_wei || "0"));
            } catch {
              return "0";
            }
          })();

          const betEth = (() => {
            try {
              return ethers.formatEther(BigInt(confirmed.bet_wei || "0"));
            } catch {
              return bet;
            }
          })();

          setSymbols(confirmedSymbols);
          setResult(Number(winEth) > 0 ? winEth : "0");

          try {
            const [bNew, hApi] = await Promise.all([
              getBalance(address).catch(() => null),
              fetchHistoryFromApi(address).catch(() => []),
            ]);
            if (bNew != null) setBalance(bNew);
            const h = Array.isArray(hApi) ? hApi : (Array.isArray(hApi?.items) ? hApi.items : []);
            setHistory(h);
          } catch { }
          return;
        } catch (e) {
          console.warn("[spin] apply confirmed failed:", e?.message || e);
        }
      }

      const fallbackWin = typeof res?.win === "string" ? res.win : "0";
      await animationDone;
      setResult(fallbackWin);

      try {
        const bNew = await getBalance(address);
        if (bNew != null) setBalance(bNew);
      } catch { }

      setHistory((prev) => [
        {
          id: Date.now(),
          time: new Date().toISOString(),
          bet,
          win: fallbackWin,
          result: Array.isArray(finalResult) ? finalResult : undefined,
        },
        ...(Array.isArray(prev) ? prev : []),
      ]);
    } catch (e) {
      console.error("[Cabinet] spin error:", e);
      setError(e?.message || "Помилка оберту");
      setSpinning(false);
    }
  }

  const historyList = Array.isArray(history) ? history : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl">Гральна кімната</h2>
        <div className="flex gap-3">
          <Link to="/deposit" className="px-3 py-1 bg-blue-600 rounded">
            Депозит
          </Link>
          <Link to="/withdraw" className="px-3 py-1 bg-yellow-600 rounded">
            Зняти гроші
          </Link>
        </div>
      </div>

      <Balance balance={balance} />

      <div className="my-4 flex items-center gap-3">
        <label className="text-gray-300">Ставка (ETH):</label>
        <input
          type="number"
          min="0.00001"
          step="0.00001"
          value={bet}
          onChange={(e) => setBet(e.target.value)}
          readOnly={priceLoaded && Number(bet) > 0}
          title={priceLoaded ? "Ціна спіна береться з контракту" : "Можна змінити ставку, якщо контракт не задає ціну"}
          className="w-28 p-2 bg-gray-900 rounded disabled:opacity-70"
        />
      </div>

      <div className="bg-gray-800 rounded p-6 my-6">
        <div className="flex justify-center gap-4 mb-4">
          {symbols.map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <Reel symbol={s} />
              <button
                onClick={() => toggleFreeze(i)}
                disabled={spinning || (!frozen[i] && frozen.filter((f) => f).length >= 2)}
                className={`mt-2 px-3 py-1 rounded text-sm ${frozen[i] ? "bg-yellow-500" : "bg-gray-600"}`}
              >
                {frozen[i] ? "Заморожено" : "Заморозити"}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleSpin}
            disabled={spinning || parseFloat(balance) <= 0}
            className="bg-red-600 px-6 py-2 rounded text-white"
          >
            {spinning ? "Очікуйте результат..." : "Зробити оберт"}
          </button>
          {error && <div className="text-red-400 mt-2">{error}</div>}
        </div>

        <div className="mt-4">
          <Result win={result} />
        </div>
      </div>

      <h3 className="text-xl mb-2">Історія</h3>
      <div className="space-y-2">
        {historyList.length === 0 && <div className="text-gray-400">Ігри відсутні</div>}
        {historyList.map((h, i) => (
          <div
            key={String(h.id ?? h.tx_hash ?? h.time ?? `${i}-${h.bet}-${h.win}`)}
            className="bg-gray-800 p-3 rounded flex justify-between"
          >
            <div>
              <div className="text-sm text-gray-300">
                {new Date(h.time ?? h.timestamp_utc ?? Date.now()).toLocaleString()}
              </div>
              {(() => {
                const mapIdx = (i) => symbolsList[Number(i)] ?? "❓";
                let display = null;
                if (Array.isArray(h.result)) {
                  display = h.result.join(" ");
                } else if (
                  h.reel_1 !== undefined && h.reel_2 !== undefined && h.reel_3 !== undefined
                ) {
                  display = [mapIdx(h.reel_1), mapIdx(h.reel_2), mapIdx(h.reel_3)].join(" ");
                }
                return display ? (
                  <div className="font-medium">Результат: {display}</div>
                ) : null;
              })()}
            </div>
            <div className="text-right">
              <div>
                {(() => {
                  const winStr = h.win ?? h.payout ?? (h.payout_wei ? ethers.formatEther(h.payout_wei.toString()) : null);
                  const isWin = winStr != null && Number(winStr) > 0;
                  return isWin ? `Виграш ${winStr} ETH` : `Програш ${h.bet ?? (h.bet_wei ? ethers.formatEther(h.bet_wei.toString()) : bet)} ETH`;
                })()}
              </div>
              <div className="text-sm text-gray-400">
                Ставка: {h.bet ?? (h.bet_wei ? ethers.formatEther(h.bet_wei.toString()) : bet)} ETH
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}