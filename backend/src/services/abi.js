// backend/src/services/abi.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Порядок поиска ABI:
 * 1) из CONTRACT_ABI_JSON (удобно для Docker/CI)
 * 2) локальный файл backend/src/abi/SlotMachine.json
 */

// --- 1) ENV-переменная (можно положить либо массив ABI, либо целиком hardhat-артефакт с полем .abi)
function abiFromEnv() {
  const raw = process.env.CONTRACT_ABI_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.abi;
  } catch (e) {
    console.warn("[abi] Failed to parse CONTRACT_ABI_JSON:", e.message);
    return null;
  }
}

// --- 2) Локальный файл рядом с кодом (надёжно для Docker)
function abiFromLocalFile() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const localFile = path.resolve(__dirname, "../abi/SlotMachine.json"); // <-- ВАЖНО: без /contracts/...
  if (!fs.existsSync(localFile)) return null;

  const json = JSON.parse(fs.readFileSync(localFile, "utf-8"));
  const abi = Array.isArray(json) ? json : json.abi;
  if (!abi || !Array.isArray(abi) || abi.length === 0) {
    throw new Error("ABI is empty in src/abi/SlotMachine.json");
  }
  return abi;
}

export const SLOT_ABI =
  abiFromEnv() ??
  abiFromLocalFile() ??
  (() => {
    throw new Error("ABI not found. Provide CONTRACT_ABI_JSON or src/abi/SlotMachine.json");
  })();



// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Путь от backend/src/services → до OnlineCasino/contracts/artifacts/...
// // services → src → backend → OnlineCasino → contracts
// const ARTIFACT_PATH = path.resolve(
//   __dirname,
//   "../../../contracts/artifacts/contracts/SlotMachine.sol/SlotMachine.json"
// );

// // Прочитаем артефакт Hardhat и возьмём abi
// const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
// if (!artifact?.abi || !Array.isArray(artifact.abi) || artifact.abi.length === 0) {
//   throw new Error(`ABI not found in artifact at ${ARTIFACT_PATH}`);
// }

// export const SLOT_ABI = artifact.abi;