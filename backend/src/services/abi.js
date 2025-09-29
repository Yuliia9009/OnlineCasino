// backend/src/services/abi.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь от backend/src/services → до OnlineCasino/contracts/artifacts/...
// services → src → backend → OnlineCasino → contracts
const ARTIFACT_PATH = path.resolve(
  __dirname,
  "../../../contracts/artifacts/contracts/SlotMachine.sol/SlotMachine.json"
);

// Прочитаем артефакт Hardhat и возьмём abi
const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
if (!artifact?.abi || !Array.isArray(artifact.abi) || artifact.abi.length === 0) {
  throw new Error(`ABI not found in artifact at ${ARTIFACT_PATH}`);
}

export const SLOT_ABI = artifact.abi;