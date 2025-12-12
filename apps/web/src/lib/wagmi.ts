/**
 * Wagmi Configuration
 * 
 * Configures wallet connection for Filecoin networks.
 * Supports MetaMask (injected) and WalletConnect.
 * 
 * Network: Filecoin Calibration Testnet (MVP default)
 */

import { http, createConfig, createStorage } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { defineChain } from 'viem';

import { getFilecoinRpcUrl, getWalletConnectProjectId } from './env';

/**
 * Filecoin Calibration Testnet Configuration
 */
export const filecoinCalibration = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: {
    decimals: 18,
    name: 'testnet FIL',
    symbol: 'tFIL',
  },
  rpcUrls: {
    default: {
      http: ['https://api.calibration.node.glif.io/rpc/v1'],
    },
    public: {
      http: ['https://api.calibration.node.glif.io/rpc/v1'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Filfox',
      url: 'https://calibration.filfox.info',
    },
  },
  testnet: true,
});

/**
 * Filecoin Mainnet Configuration (for future use)
 */
export const filecoinMainnet = defineChain({
  id: 314,
  name: 'Filecoin',
  nativeCurrency: {
    decimals: 18,
    name: 'FIL',
    symbol: 'FIL',
  },
  rpcUrls: {
    default: {
      http: ['https://api.node.glif.io/rpc/v1'],
    },
    public: {
      http: ['https://api.node.glif.io/rpc/v1'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Filfox',
      url: 'https://filfox.info',
    },
  },
  testnet: false,
});

/**
 * Get the active chain (Calibration for MVP)
 */
export function getActiveChain() {
  return filecoinCalibration;
}

/**
 * Build wagmi connectors
 */
function buildConnectors() {
  const wcProjectId = getWalletConnectProjectId();
  
  if (wcProjectId) {
    return [
      injected({ shimDisconnect: true }),
      walletConnect({
        projectId: wcProjectId,
        metadata: {
          name: 'WitnessChain',
          description: 'Decentralized platform for preserving human rights evidence',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://witnesschain.io',
          icons: ['https://witnesschain.io/icon.png'],
        },
        showQrModal: true,
      }),
    ];
  }

  return [injected({ shimDisconnect: true })];
}

/**
 * Create wagmi config for Filecoin Calibration testnet
 */
export function createWagmiConfig() {
  const rpcUrl = getFilecoinRpcUrl();

  return createConfig({
    chains: [filecoinCalibration],
    connectors: buildConnectors(),
    transports: {
      [filecoinCalibration.id]: http(rpcUrl),
    },
    storage: createStorage({
      storage: typeof window !== 'undefined' ? window.localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
      key: 'witnesschain-wallet',
    }),
    ssr: true,
  });
}

/**
 * Singleton config instance
 */
let wagmiConfigInstance: ReturnType<typeof createWagmiConfig> | null = null;

export function getWagmiConfig() {
  if (!wagmiConfigInstance) {
    wagmiConfigInstance = createWagmiConfig();
  }
  return wagmiConfigInstance;
}

/**
 * Reset wagmi config (for testing)
 */
export function resetWagmiConfig() {
  wagmiConfigInstance = null;
}

/**
 * Chain metadata for UI display
 */
export const CHAIN_METADATA = {
  [filecoinCalibration.id]: {
    name: 'Filecoin Calibration',
    shortName: 'Calibration',
    isTestnet: true,
    faucetUrl: 'https://faucet.calibration.fildev.network/',
    explorerUrl: 'https://calibration.filfox.info',
  },
  [filecoinMainnet.id]: {
    name: 'Filecoin Mainnet',
    shortName: 'Mainnet',
    isTestnet: false,
    explorerUrl: 'https://filfox.info',
  },
} as const;

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string, chainId?: number): string {
  const chain = chainId ?? filecoinCalibration.id;
  const metadata = CHAIN_METADATA[chain as keyof typeof CHAIN_METADATA];
  return `${metadata?.explorerUrl ?? 'https://filfox.info'}/message/${txHash}`;
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(address: string, chainId?: number): string {
  const chain = chainId ?? filecoinCalibration.id;
  const metadata = CHAIN_METADATA[chain as keyof typeof CHAIN_METADATA];
  return `${metadata?.explorerUrl ?? 'https://filfox.info'}/address/${address}`;
}
