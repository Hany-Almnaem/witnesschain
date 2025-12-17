/**
 * Synapse SDK Client for Filecoin Storage
 *
 * Provides a singleton client for interacting with Filecoin storage via the Synapse SDK.
 * This module handles:
 * - Client initialization with proper wallet configuration
 * - File upload to Filecoin with paid deals
 * - File retrieval by PieceCID
 * - Connection health checks
 *
 * IMPORTANT: This module requires BACKEND_PRIVATE_KEY to be set for storage operations.
 * The private key is used to sign storage deals and pay for storage.
 */

import { Synapse } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

import { getEnv } from './env.js';
import { StorageError, StorageErrorCode } from './storage-errors.js';

/** Synapse client singleton */
let synapseClient: Synapse | null = null;

/** Provider singleton for connection checks */
let provider: ethers.JsonRpcProvider | null = null;

/**
 * Get or create the Ethers provider for Filecoin RPC
 */
function getProvider(): ethers.JsonRpcProvider {
  if (provider) {
    return provider;
  }

  const env = getEnv();
  provider = new ethers.JsonRpcProvider(env.FILECOIN_RPC_URL);
  return provider;
}

/**
 * Get or create the Synapse SDK client
 *
 * @throws {StorageError} If BACKEND_PRIVATE_KEY is not configured
 */
export async function getSynapseClient(): Promise<Synapse> {
  if (synapseClient) {
    return synapseClient;
  }

  const env = getEnv();

  if (!env.BACKEND_PRIVATE_KEY) {
    throw new StorageError(
      StorageErrorCode.CLIENT_NOT_CONFIGURED,
      'Storage client not configured. Missing BACKEND_PRIVATE_KEY.',
      'BACKEND_PRIVATE_KEY not set in environment'
    );
  }

  // Create Synapse client with private key
  // The SDK auto-detects network from the RPC endpoint
  synapseClient = await Synapse.create({
    privateKey: env.BACKEND_PRIVATE_KEY,
    rpcURL: env.FILECOIN_RPC_URL,
  });

  const wallet = new ethers.Wallet(env.BACKEND_PRIVATE_KEY);
  console.info(`[Synapse] Client initialized for network: ${synapseClient.getNetwork()}`);
  console.info(`[Synapse] Wallet address: ${wallet.address}`);

  return synapseClient;
}

/**
 * Check if Synapse SDK is connected and operational
 *
 * @returns True if connected, false otherwise
 */
export async function isSynapseConnected(): Promise<boolean> {
  try {
    const env = getEnv();

    if (!env.BACKEND_PRIVATE_KEY) {
      console.warn('[Synapse] Health check skipped: BACKEND_PRIVATE_KEY not configured');
      return false;
    }

    const client = await getSynapseClient();
    // Verify client has required services
    return client.payments !== undefined && client.storage !== undefined;
  } catch (error) {
    console.error('[Synapse] Connection check failed:', error);
    return false;
  }
}

/**
 * Get the wallet balance for storage operations
 *
 * @returns Balance in FIL as string, or null if unavailable
 */
export async function getWalletBalance(): Promise<string | null> {
  try {
    const env = getEnv();
    if (!env.BACKEND_PRIVATE_KEY) {
      return null;
    }

    const rpcProvider = getProvider();
    const wallet = new ethers.Wallet(env.BACKEND_PRIVATE_KEY, rpcProvider);
    const balance = await rpcProvider.getBalance(wallet.address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('[Synapse] Failed to get wallet balance:', error);
    return null;
  }
}

/**
 * Get the wallet address used for storage payments
 */
export function getWalletAddress(): string | null {
  const env = getEnv();
  if (!env.BACKEND_PRIVATE_KEY) {
    return null;
  }

  try {
    const wallet = new ethers.Wallet(env.BACKEND_PRIVATE_KEY);
    return wallet.address;
  } catch {
    return null;
  }
}

/**
 * Reset the Synapse client (for testing or reconfiguration)
 */
export function resetSynapseClient(): void {
  synapseClient = null;
  provider = null;
}

/**
 * Get storage service info (if available)
 */
export async function getStorageInfo(): Promise<{
  network: string;
  walletAddress: string | null;
  balance: string | null;
} | null> {
  try {
    const env = getEnv();
    const walletAddress = getWalletAddress();
    const balance = await getWalletBalance();

    return {
      network: env.FILECOIN_NETWORK,
      walletAddress,
      balance,
    };
  } catch (error) {
    console.error('[Synapse] Failed to get storage info:', error);
    return null;
  }
}
