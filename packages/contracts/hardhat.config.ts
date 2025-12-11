import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ignition-ethers';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const CALIBRATION_RPC_URL = process.env.FILECOIN_RPC_URL ?? 'https://api.calibration.node.glif.io/rpc/v1';
const MAINNET_RPC_URL = process.env.FILECOIN_MAINNET_RPC_URL ?? 'https://api.node.glif.io/rpc/v1';
const PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY ?? '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    calibration: {
      url: CALIBRATION_RPC_URL,
      chainId: 314159,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      chainId: 314,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
