/**
 * Environment configuration for the web app
 * Client-side environment variables (NEXT_PUBLIC_ prefix)
 */

/**
 * Get API URL from environment
 */
export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

/**
 * Get Filecoin RPC URL from environment
 */
export function getFilecoinRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_FILECOIN_RPC_URL ??
    'https://api.calibration.node.glif.io/rpc/v1'
  );
}

/**
 * Get chain ID for wallet connection
 */
export function getChainId(): number {
  return parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '314159', 10);
}

/**
 * Get evidence registry contract address
 */
export function getContractAddress(): string | undefined {
  return process.env.NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS;
}

/**
 * Get WalletConnect project ID
 */
export function getWalletConnectProjectId(): string | undefined {
  return process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
}

/**
 * Check if we're on the Filecoin mainnet
 */
export function isMainnet(): boolean {
  return process.env.NEXT_PUBLIC_FILECOIN_NETWORK === 'mainnet';
}
