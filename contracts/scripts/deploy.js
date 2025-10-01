// contracts/scripts/deploy.js
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function writeFileSafe(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  console.log("[deploy] wrote", p);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainIdHex = await hre.network.provider.send("eth_chainId", []);
  const chainIdNum = Number(chainIdHex);

  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Network: ${hre.network.name} (chainId=${chainIdNum})`);

  // 1) deploy
  const SlotMachine = await hre.ethers.getContractFactory("SlotMachine");
  const slot = await SlotMachine.deploy();
  await slot.waitForDeployment();
  const address = await slot.getAddress(); 
  console.log("SlotMachine deployed at:", address);

  // 2) ABI из артефактов
  const artifact = await hre.artifacts.readArtifact("SlotMachine");
  const abi = artifact.abi;

  // --- A) Docker-путь
  const outDir = process.env.OUT_DIR || process.env.OUT || null;
  if (outDir) {
    const jsonPath = path.join(outDir, "slot.json");
    const envPath  = path.join(outDir, "slot.env");

    writeFileSafe(
      jsonPath,
      JSON.stringify({ contract: "SlotMachine", address, chainId: chainIdNum }, null, 2)
    );

    const envLines = [
      `VITE_CONTRACT_ADDRESS=${address}`,
      `VITE_CHAIN_ID=${chainIdNum}`,
      `CONTRACT_ADDRESS_${chainIdNum}=${address}`,
    ].join("\n") + "\n";
    writeFileSafe(envPath, envLines);

    console.log("\n✅ Done (Docker mode).");
    return;
  }

  // --- B) Локальный режим
  const FRONT_ROOT = path.resolve(__dirname, "..", "frontend");
  const ABI_DIR = path.join(FRONT_ROOT, "src", "abi");
  const ABI_PATH = path.join(ABI_DIR, "SlotMachine.json");
  const CFG_DIR = path.join(FRONT_ROOT, "src", "utils");
  const CFG_PATH = path.join(CFG_DIR, "contractConfig.json");
  const ENV_PATH = path.join(FRONT_ROOT, ".env");

  writeFileSafe(ABI_PATH, JSON.stringify({ abi }, null, 2));
  writeFileSafe(
    CFG_PATH,
    JSON.stringify({ address, chainId: chainIdNum, updatedAt: new Date().toISOString() }, null, 2)
  );
  const envLines = [`VITE_CONTRACT_ADDRESS=${address}`, `VITE_CHAIN_ID=${chainIdNum}`].join("\n") + "\n";
  writeFileSafe(ENV_PATH, envLines);

  console.log("\n✅ Done (local mode). Frontend env written to .env. If Vite is running, restart it to pick up changes.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// const fs = require("fs");
// const path = require("path");
// const hre = require("hardhat");

// async function main() {
//   const [deployer] = await hre.ethers.getSigners();
//   const chainId = Number(await hre.network.provider.send("eth_chainId", []));
//   const chainIdNum = Number(chainId);

//   console.log(`Deploying from: ${deployer.address}`);
//   console.log(`Network: ${hre.network.name} (chainId=${chainIdNum})`);

//   // 1) deploy
//   const SlotMachine = await hre.ethers.getContractFactory("SlotMachine");
//   const slot = await SlotMachine.deploy();
//   await slot.waitForDeployment();
//   const address = await slot.getAddress();
//   console.log("SlotMachine deployed at:", address);

//   // 2) достанем ABI из артефактов
//   const artifact = await hre.artifacts.readArtifact("SlotMachine");
//   const abi = artifact.abi;

//   // 3) пути во фронт
//   const FRONT_ROOT = path.resolve(__dirname, "..", "frontend");
//   // если фронт у тебя в другом месте — поправь путь ↑
//   const ABI_DIR = path.join(FRONT_ROOT, "src", "abi");
//   const ABI_PATH = path.join(ABI_DIR, "SlotMachine.json");
//   const CFG_DIR = path.join(FRONT_ROOT, "src", "utils");
//   const CFG_PATH = path.join(CFG_DIR, "contractConfig.json");
//   const ENV_PATH = path.join(FRONT_ROOT, ".env.local");

//   fs.mkdirSync(ABI_DIR, { recursive: true });
//   fs.mkdirSync(CFG_DIR, { recursive: true });

//   // 4) пишем ABI (только abi, без байткода, чтобы легче грузилось)
//   fs.writeFileSync(ABI_PATH, JSON.stringify({ abi }, null, 2));
//   console.log("ABI saved ->", ABI_PATH);

//   // 5) пишем конфиг для фронта
//   const cfg = {
//     address,
//     chainId: chainIdNum,
//     updatedAt: new Date().toISOString(),
//   };
//   fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
//   console.log("contractConfig saved ->", CFG_PATH);

//   // 6) обновим .env.local для Vite
//   const envLines = [
//     `VITE_CONTRACT_ADDRESS=${address}`,
//     `VITE_CHAIN_ID=${chainIdNum}`,
//   ].join("\n");
//   fs.writeFileSync(ENV_PATH, envLines + "\n");
//   console.log(".env.local updated ->", ENV_PATH);

//   console.log("\n✅ Done!");
//   console.log("Restart frontend if running so Vite picks up .env.local.");
// }

// main().catch((e) => {
//   console.error(e);
//   process.exit(1);
// });