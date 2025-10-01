import { ethers } from "ethers";
import { fetchHistory as fetchHistoryFromApi, apiConfirmSpin } from "./api";
import SlotMachine from "../abi/SlotMachine.json";

/* ========= Константи ========= */
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
export const CONTRACT_ABI = SlotMachine.abi;
export const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337); // 31337 = Hardhat

// Адмін-адреси
const RAW_ADMINS = (import.meta.env.VITE_ADMIN_ADDRESSES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const ADMINS = RAW_ADMINS.map((a) => a.toLowerCase());
export function isAdmin(address) {
  return !!address && ADMINS.includes(address.toLowerCase());
}

/* ========= Внутрішнє состояние ========= */
let provider = null;
let signer = null;
let deployedCheckPromise = null;

// Serialize expensive RPC setup to avoid MetaMask "circuit breaker" on parallel calls
let ensureReadyPromise = null;

async function ensureReady() {
  if (!window.ethereum) throw new Error("No MetaMask");
  provider ||= new ethers.BrowserProvider(window.ethereum);

  // Create (or reuse) a single inflight promise so concurrent callers wait instead of spamming RPC
  if (!ensureReadyPromise) {
    ensureReadyPromise = (async () => {
      await switchToExpectedChain(provider);
      await assertDeployedOnce(provider);
      try {
        signer ||= await provider.getSigner();
      } catch (_) {
        // no signer yet (readonly)
      }
    })();
  }
  return ensureReadyPromise;
}

/* ========= Хелперы сети/контракта ========= */
async function switchToExpectedChain(p) {
  const targetHex = "0x" + EXPECTED_CHAIN_ID.toString(16);
  const currentHex = await p.send("eth_chainId", []);
  if (currentHex === targetHex) return;

  try {
    await p.send("wallet_switchEthereumChain", [{ chainId: targetHex }]);
  } catch (e) {
    if (e.code === 4902) {
      await p.send("wallet_addEthereumChain", [{
        chainId: targetHex,
        chainName: "Hardhat Localhost",
        rpcUrls: ["http://127.0.0.1:8545"],
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      }]);
    } else {
      throw e;
    }
  }
}

function assertDeployedOnce(p) {
  // Cache the first successful code check to avoid spamming MetaMask RPC
  if (!deployedCheckPromise) {
    deployedCheckPromise = (async () => {
      await assertDeployed(p);
      return true;
    })().catch((e) => {
      // reset cache on failure so the next attempt can retry
      deployedCheckPromise = null;
      throw e;
    });
  }
  return deployedCheckPromise;
}

async function assertDeployed(p) {
  if (!CONTRACT_ADDRESS) throw new Error("Missing VITE_CONTRACT_ADDRESS");
  let code = "0x";
  try {
    if (typeof p.getCode === "function") {
      code = await p.getCode(CONTRACT_ADDRESS);
    } else {
      code = await p.send("eth_getCode", [CONTRACT_ADDRESS, "latest"]);
    }
  } catch {
    code = await p.send("eth_getCode", [CONTRACT_ADDRESS, "latest"]);
  }
  if (!code || code === "0x") {
    throw new Error(
      `No contract code at ${CONTRACT_ADDRESS} on chain ${EXPECTED_CHAIN_ID}. ` +
      `Re-deploy and update VITE_CONTRACT_ADDRESS.`
    );
  }
}

async function getContract(readonly = false) {
  if (!window.ethereum) throw new Error("No MetaMask");
  await ensureReady();
  if (readonly || !signer) {
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

/* ========= API ========= */

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No MetaMask");
  provider = new ethers.BrowserProvider(window.ethereum);

  // If already connected, don't spam MetaMask with another request
  let accounts = [];
  try {
    accounts = await provider.send("eth_accounts", []);
  } catch (_) {}
  if (!accounts || accounts.length === 0) {
    await provider.send("eth_requestAccounts", []);
  }

  await ensureReady();
  signer = await provider.getSigner();
  return await signer.getAddress();
}

// Цена спіна з контракта
export async function getSpinPrice() {
  const c = await getContract(true);
  const wei = await c.spinPrice();
  return ethers.formatEther(wei);
}

// Внутрішнній баланс гравця в контракті
export async function getBalance(address) {
  const c = await getContract(true);
  const wei = await c.balances(address);
  return ethers.formatEther(wei);
}

// Історія — через бекенд 
export async function getHistory(address) {
  return fetchHistoryFromApi(address, EXPECTED_CHAIN_ID);
}

// Поповнення — в контракт 
export async function deposit(amountEth) {
  const c = await getContract();
  const value = ethers.parseEther(String(amountEth));
  const tx = await c.deposit({ value });
  await tx.wait();
  return { status: "ok", txHash: tx.hash };
}

// Вивід з внутрішнього баланса контракта
export async function withdraw(amountEth) {
  const c = await getContract();
  const amount = ethers.parseEther(String(amountEth));
  const tx = await c.withdraw(amount);
  await tx.wait();
  return { status: "ok", txHash: tx.hash };
}

/* ========= Spin ========= */

function extractRevertMessage(e) {
  try {
    const m = e?.error?.message || e?.data?.message || e?.message || "";
    const known = m.match(/revert(?:ed)?:?\s*(.+)$/i);
    return known ? known[1] : m;
  } catch {
    return "Transaction reverted";
  }
}

export async function spinSlot() {
  const c = await getContract();

  // 0) перевірка для газу
  try {
    const addr = signer ? await signer.getAddress() : (await c.runner.getAddress());
    const extBal = await c.runner.provider.getBalance(addr);
    if (extBal === 0n) {
      throw new Error("На гаманці немає ETH для оплати gas.");
    }
  } catch (_) { /* игнор */ }

  // 1) eth_call — спіймати revert до вікна MetaMask
  try {
    await c.play.staticCall();
  } catch (e) {
    throw new Error(extractRevertMessage(e));
  }

  // 2) газ з запасом
  let gasLimit;
  try {
    const est = await c.play.estimateGas();
    gasLimit = (est * 125n) / 100n; // +25%
  } catch (_) {
    gasLimit = 300000n;
  }

  // 3) Відправка транзакцій
  try {
    const tx = await c.play({ gasLimit });
    const receipt = await tx.wait();

    let parsedReels = null;
    let parsedWin = null;
    try {
      const iface = new ethers.Interface(CONTRACT_ABI);
      for (const log of receipt.logs || []) {
        try {
          const ev = iface.parseLog(log);
          if (ev && ev.name === "SpinPlayed") {
            const reels = Array.isArray(ev.args?.reels) ? ev.args.reels.map((x) => Number(x)) : null;
            const win = ev.args?.winAmount != null ? ethers.formatEther(ev.args.winAmount) : null;
            parsedReels = reels;
            parsedWin = win;
            break;
          }
        } catch {}
      }
    } catch {}

    try {
      const addr = signer ? await signer.getAddress() : null;
      await apiConfirmSpin({
        txHash: tx.hash,
        address: addr || undefined,
        chainId: EXPECTED_CHAIN_ID,
      });
    } catch (e2) {
      console.warn("[spin] confirm failed:", e2?.message || e2);
    }

    let resultEmojis = null;
    if (parsedReels) {
      const EMOJIS = ["🍒", "🍋", "🍊", "⭐", "7️⃣"];
      resultEmojis = parsedReels.map((i) => EMOJIS[i] ?? "❓");
    }

    return {
      status: "ok",
      txHash: tx.hash,
      receipt,
      ...(resultEmojis ? { result: resultEmojis } : {}),
      ...(parsedWin != null ? { win: parsedWin } : {}),
    };
  } catch (e) {
    const msg = extractRevertMessage(e);
    if (/replacement fee too low|nonce/i.test(msg)) {
      throw new Error("Tx відхилено гаманцем (nonce/fee). Спробуйте ще раз.");
    }
    if (/User denied|rejected/i.test(msg)) {
      throw new Error("Транзакцію відхилено у MetaMask.");
    }
    throw new Error(msg || "Помилка надсилання транзакції");
  }
}

/* ========= Підписка ========= */
function resetConnectionCache() {
  // allow re-running ensureReady for a new account/network
  ensureReadyPromise = null;
  signer = null;
}

export function onAccountChange(cb) {
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
      resetConnectionCache();
      cb(accounts.length ? accounts[0] : null);
    });
  }
}