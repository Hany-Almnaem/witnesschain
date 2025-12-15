/**
 * FVM Client for On-chain Evidence Registration
 *
 * Handles interaction with the EvidenceRegistry smart contract on FVM.
 * Uses ethers.js for contract interaction (consistent with existing backend).
 */

import { ethers, type ContractTransactionReceipt, keccak256, toUtf8Bytes } from 'ethers';
import { getEnv } from './env.js';

/**
 * EvidenceRegistry ABI (minimal subset for backend operations)
 */
const EVIDENCE_REGISTRY_ABI = [
  // Read functions
  'function VERSION() view returns (string)',
  'function deployer() view returns (address)',
  'function evidenceCount() view returns (uint256)',
  'function evidenceExists(bytes32 evidenceId) view returns (bool)',
  'function isVerified(bytes32 evidenceId) view returns (bool)',
  'function getEvidence(bytes32 evidenceId) view returns (tuple(bytes32 evidenceId, bytes32 contentHash, string pieceCid, string providerAddress, address submitter, uint256 timestamp, uint256 blockNumber, bool verified))',
  // Write functions
  'function registerEvidence(bytes32 evidenceId, bytes32 contentHash, string pieceCid, string providerAddress)',
  'function verifyEvidence(bytes32 evidenceId)',
  // Events
  'event EvidenceRegistered(bytes32 indexed evidenceId, bytes32 indexed contentHash, string pieceCid, string providerAddress, address indexed submitter, uint256 timestamp, uint256 blockNumber)',
  'event EvidenceVerified(bytes32 indexed evidenceId, address indexed verifier, uint256 timestamp)',
];

// Singleton instances
let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

/**
 * Get the FVM JSON-RPC provider
 */
function getProvider(): ethers.JsonRpcProvider {
  if (provider) return provider;

  const env = getEnv();
  provider = new ethers.JsonRpcProvider(env.FILECOIN_RPC_URL);
  return provider;
}

/**
 * Get the signer for transactions
 * Uses the backend wallet configured in environment
 */
function getSigner(): ethers.Wallet | null {
  if (signer) return signer;

  const env = getEnv();
  if (!env.BACKEND_PRIVATE_KEY) {
    console.warn('[FVM] No BACKEND_PRIVATE_KEY configured - write operations disabled');
    return null;
  }

  signer = new ethers.Wallet(env.BACKEND_PRIVATE_KEY, getProvider());
  return signer;
}

/**
 * Get the EvidenceRegistry contract instance
 */
function getContract(): ethers.Contract | null {
  if (contract) return contract;

  const env = getEnv();
  if (!env.EVIDENCE_REGISTRY_ADDRESS) {
    console.warn('[FVM] No EVIDENCE_REGISTRY_ADDRESS configured');
    return null;
  }

  const signerOrProvider = getSigner() ?? getProvider();
  contract = new ethers.Contract(env.EVIDENCE_REGISTRY_ADDRESS, EVIDENCE_REGISTRY_ABI, signerOrProvider);
  return contract;
}

/**
 * On-chain evidence record
 */
export interface OnChainEvidence {
  evidenceId: string;
  contentHash: string;
  pieceCid: string;
  providerAddress: string;
  submitter: string;
  timestamp: number;
  blockNumber: number;
  verified: boolean;
}

/**
 * Registration result
 */
export interface RegistrationResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  timestamp?: number;
  error?: string;
}

/**
 * Check if FVM connection is available
 */
export async function isFvmConnected(): Promise<boolean> {
  try {
    const p = getProvider();
    const network = await p.getNetwork();
    return network.chainId === 314159n || network.chainId === 314n;
  } catch (error) {
    console.error('[FVM] Connection check failed:', error);
    return false;
  }
}

/**
 * Check if FVM contract is configured and accessible
 */
export async function isContractAvailable(): Promise<boolean> {
  try {
    const c = getContract();
    if (!c) return false;

    // Try to read the version
    const version = await c.VERSION();
    return typeof version === 'string' && version.length > 0;
  } catch (error) {
    console.error('[FVM] Contract availability check failed:', error);
    return false;
  }
}

/**
 * Get FVM connection info for health check
 */
export async function getFvmInfo(): Promise<{
  connected: boolean;
  network: string | null;
  chainId: number | null;
  contractAddress: string | null;
  walletAddress: string | null;
  balance: string | null;
}> {
  try {
    const p = getProvider();
    const network = await p.getNetwork();
    const s = getSigner();

    let walletAddress: string | null = null;
    let balance: string | null = null;

    if (s) {
      walletAddress = await s.getAddress();
      const balanceWei = await p.getBalance(walletAddress);
      balance = ethers.formatEther(balanceWei);
    }

    const env = getEnv();

    return {
      connected: true,
      network: network.name,
      chainId: Number(network.chainId),
      contractAddress: env.EVIDENCE_REGISTRY_ADDRESS ?? null,
      walletAddress,
      balance,
    };
  } catch (error) {
    console.error('[FVM] Failed to get info:', error);
    return {
      connected: false,
      network: null,
      chainId: null,
      contractAddress: null,
      walletAddress: null,
      balance: null,
    };
  }
}

/**
 * Convert UUID string to bytes32 (consistent with frontend)
 */
export function uuidToBytes32(uuid: string): string {
  if (!uuid || typeof uuid !== 'string') {
    throw new Error('Invalid UUID: must be a non-empty string');
  }
  return keccak256(toUtf8Bytes(uuid));
}

/**
 * Validate content hash format
 */
export function isValidContentHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Register evidence on-chain
 *
 * @param evidenceId - UUID of the evidence
 * @param contentHash - SHA-256 hash of original content (0x prefixed)
 * @param pieceCid - Filecoin PieceCID
 * @param providerAddress - Storage provider address
 */
export async function registerEvidenceOnChain(
  evidenceId: string,
  contentHash: string,
  pieceCid: string,
  providerAddress: string
): Promise<RegistrationResult> {
  const c = getContract();
  if (!c) {
    return {
      success: false,
      error: 'Contract not configured. Set EVIDENCE_REGISTRY_ADDRESS in environment.',
    };
  }

  const s = getSigner();
  if (!s) {
    return {
      success: false,
      error: 'Wallet not configured. Set BACKEND_PRIVATE_KEY in environment.',
    };
  }

  // Validate inputs
  if (!evidenceId) {
    return { success: false, error: 'Evidence ID is required' };
  }

  if (!isValidContentHash(contentHash)) {
    return { success: false, error: 'Invalid content hash format' };
  }

  if (!pieceCid) {
    return { success: false, error: 'PieceCID is required' };
  }

  if (!providerAddress) {
    return { success: false, error: 'Provider address is required' };
  }

  try {
    const evidenceIdBytes32 = uuidToBytes32(evidenceId);

    console.info(`[FVM] Registering evidence: ${evidenceId}`);
    console.info(`[FVM] Content hash: ${contentHash}`);
    console.info(`[FVM] PieceCID: ${pieceCid}`);

    // Estimate gas
    const gasEstimate = await c.registerEvidence.estimateGas(
      evidenceIdBytes32,
      contentHash,
      pieceCid,
      providerAddress
    );

    // Add 20% buffer
    const gasLimit = (gasEstimate * 120n) / 100n;

    // Send transaction
    const tx = await c.registerEvidence(
      evidenceIdBytes32,
      contentHash,
      pieceCid,
      providerAddress,
      { gasLimit }
    );

    console.info(`[FVM] Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt: ContractTransactionReceipt = await tx.wait(1);

    if (receipt.status === 0) {
      return {
        success: false,
        txHash: receipt.hash,
        error: 'Transaction reverted',
      };
    }

    // Get block timestamp
    const block = await getProvider().getBlock(receipt.blockNumber);
    const timestamp = block ? Number(block.timestamp) : undefined;

    console.info(`[FVM] Evidence registered at block ${receipt.blockNumber}`);

    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp,
    };
  } catch (error) {
    const errorString = String(error);
    console.error('[FVM] Registration failed:', errorString);

    // Parse known errors
    if (errorString.includes('EvidenceAlreadyExists')) {
      return {
        success: false,
        error: 'Evidence already exists on-chain',
      };
    }

    if (errorString.includes('insufficient funds')) {
      return {
        success: false,
        error: 'Insufficient FIL balance for transaction',
      };
    }

    return {
      success: false,
      error: 'Failed to register evidence on-chain',
    };
  }
}

/**
 * Get evidence from on-chain registry
 */
export async function getEvidenceFromChain(evidenceId: string): Promise<OnChainEvidence | null> {
  const c = getContract();
  if (!c) {
    console.warn('[FVM] Contract not available');
    return null;
  }

  try {
    const evidenceIdBytes32 = uuidToBytes32(evidenceId);

    // Check if exists first
    const exists = await c.evidenceExists(evidenceIdBytes32);
    if (!exists) {
      return null;
    }

    const result = await c.getEvidence(evidenceIdBytes32);

    return {
      evidenceId: result[0],
      contentHash: result[1],
      pieceCid: result[2],
      providerAddress: result[3],
      submitter: result[4],
      timestamp: Number(result[5]),
      blockNumber: Number(result[6]),
      verified: result[7],
    };
  } catch (error) {
    console.error('[FVM] Failed to get evidence:', error);
    return null;
  }
}

/**
 * Check if evidence exists on-chain
 */
export async function evidenceExistsOnChain(evidenceId: string): Promise<boolean> {
  const c = getContract();
  if (!c) return false;

  try {
    const evidenceIdBytes32 = uuidToBytes32(evidenceId);
    return await c.evidenceExists(evidenceIdBytes32);
  } catch {
    return false;
  }
}

/**
 * Check if evidence is verified on-chain
 */
export async function isEvidenceVerified(evidenceId: string): Promise<boolean> {
  const c = getContract();
  if (!c) return false;

  try {
    const evidenceIdBytes32 = uuidToBytes32(evidenceId);
    return await c.isVerified(evidenceIdBytes32);
  } catch {
    return false;
  }
}

/**
 * Get total evidence count from contract
 */
export async function getEvidenceCount(): Promise<number> {
  const c = getContract();
  if (!c) return 0;

  try {
    const count = await c.evidenceCount();
    return Number(count);
  } catch {
    return 0;
  }
}

/**
 * Reset client instances (for testing)
 */
export function resetFvmClient(): void {
  provider = null;
  signer = null;
  contract = null;
}

