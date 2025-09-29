require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  RPC_URL_31337,
  RPC_URL_11155111,
  PRIVATE_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

module.exports = {
  solidity: "0.8.24",
  networks: {
    // in-memory hardhat
    hardhat: {
      chainId: 31337,
    },
    // локальный нод (npx hardhat node)
    localhost: {
      url: RPC_URL_31337 || "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Sepolia testnet
    sepolia: {
      url: RPC_URL_11155111 || "",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },
};