import { useEffect, useState } from "react";
import { connectWallet, deposit as onchainDeposit, getBalance } from "../utils/web3";
import { confirmDeposit } from "../utils/api";

export default function DepositPage() {
  const [address, setAddress] = useState(null);
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [internalBalance, setInternalBalance] = useState("0");

  useEffect(() => {
    if (window.ethereum) {
      const handler = (accs) => {
        const a = accs?.[0] || null;
        setAddress(a);
        setOk("");
        setError("");
        if (a) refreshInternal(a);
      };
      window.ethereum.on("accountsChanged", handler);
      return () => window.ethereum.removeListener("accountsChanged", handler);
    }
  }, []);

  async function refreshInternal(a = address) {
    if (!a) return;
    try {
      const bal = await getBalance(a);
      setInternalBalance(bal);
    } catch (e) {
    }
  }

  async function handleConnect() {
    try {
      setBusy(true);
      const a = await connectWallet();
      setAddress(a);
      setError("");
      await refreshInternal(a);
    } catch (e) {
      setError(e.message || "Не удалось подключить кошелёк");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeposit(e) {
    e?.preventDefault?.();
    if (!address) {
      setError("Сначала подключи кошелёк");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Введи сумму > 0");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setOk("");

      const tx = await onchainDeposit(amount);
      const txHash = tx.hash || tx.txHash || tx.transactionHash;
      if (!txHash) throw new Error("Transaction hash not found");

      const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31337);
      await confirmDeposit({ txHash, expectedPlayer: address, chainId });

      setOk(`Депозит підтверджено • tx: ${txHash.slice(0, 10)}…`);
      await refreshInternal();
    } catch (e) {
      setError(e.message || "Помилка депозиту");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-16 p-8 bg-[#10131a] rounded-xl shadow-lg">
      <h2 className="text-2xl font-semibold mb-6 text-white">Поповнення балансу</h2>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          Статус:{" "}
          {address ? (
            <span className="text-green-400">підключено {address.slice(0, 6)}…{address.slice(-4)}</span>
          ) : (
            <span className="text-red-400">гаманець не підключений</span>
          )}
        </div>
        {!address && (
          <button
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={handleConnect}
            disabled={busy}
          >
            Підключити гаманець
          </button>
        )}
      </div>

      <form onSubmit={handleDeposit}>
        <label className="block text-gray-300 text-sm mb-2">Сума (ETH)</label>
        <input
          type="number"
          step="0.0001"
          min="0"
          className="w-full px-4 py-3 rounded-md bg-[#0b0e14] border border-gray-700 text-white outline-none focus:border-indigo-500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!address || busy}
        />

        <button
          className="mt-6 px-5 py-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          onClick={handleDeposit}
          disabled={!address || busy}
          type="submit"
        >
          {busy ? "Проводимо транзакцію…" : "Поповнити"}
        </button>
      </form>

      {ok && <p className="mt-4 text-green-400 text-sm">{ok}</p>}
      {error && <p className="mt-4 text-red-400 text-sm">✖ {error}</p>}

      <div className="mt-6 text-gray-400 text-sm">
        Внутрішній баланс у контракті: <span className="text-white">{internalBalance} ETH</span>
      </div>
    </div>
  );
}