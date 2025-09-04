import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const abiJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../abi/SlotMachine.json"), "utf8")
);

// Если файл содержит { "abi": [...] }
export const SLOT_ABI = abiJson.abi || abiJson;

// Временная заглушка: 
export const abi = [
  /* JSON ABI от Димы */
];