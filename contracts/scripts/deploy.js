const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number(await hre.network.provider.send("eth_chainId", []));
  const chainIdNum = Number(chainId);

  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Network: ${hre.network.name} (chainId=${chainIdNum})`);

  // 1) deploy
  const SlotMachine = await hre.ethers.getContractFactory("SlotMachine");
  const slot = await SlotMachine.deploy();
  await slot.waitForDeployment();
  const address = await slot.getAddress();
  console.log("SlotMachine deployed at:", address);

  // 2) достанем ABI из артефактов
  const artifact = await hre.artifacts.readArtifact("SlotMachine");
  const abi = artifact.abi;

  // 3) пути во фронт
  const FRONT_ROOT = path.resolve(__dirname, "..", "frontend");
  // если фронт у тебя в другом месте — поправь путь ↑
  const ABI_DIR = path.join(FRONT_ROOT, "src", "abi");
  const ABI_PATH = path.join(ABI_DIR, "SlotMachine.json");
  const CFG_DIR = path.join(FRONT_ROOT, "src", "utils");
  const CFG_PATH = path.join(CFG_DIR, "contractConfig.json");
  const ENV_PATH = path.join(FRONT_ROOT, ".env.local");

  fs.mkdirSync(ABI_DIR, { recursive: true });
  fs.mkdirSync(CFG_DIR, { recursive: true });

  // 4) пишем ABI (только abi, без байткода, чтобы легче грузилось)
  fs.writeFileSync(ABI_PATH, JSON.stringify({ abi }, null, 2));
  console.log("ABI saved ->", ABI_PATH);

  // 5) пишем конфиг для фронта
  const cfg = {
    address,
    chainId: chainIdNum,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
  console.log("contractConfig saved ->", CFG_PATH);

  // 6) обновим .env.local для Vite
  const envLines = [
    `VITE_CONTRACT_ADDRESS=${address}`,
    `VITE_CHAIN_ID=${chainIdNum}`,
  ].join("\n");
  fs.writeFileSync(ENV_PATH, envLines + "\n");
  console.log(".env.local updated ->", ENV_PATH);

  console.log("\n✅ Done!");
  console.log("Restart frontend if running so Vite picks up .env.local.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});