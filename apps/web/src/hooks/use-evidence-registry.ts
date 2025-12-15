/**
 * useEvidenceRegistry Hook
 *
 * Provides functions to interact with the EvidenceRegistry smart contract.
 * Uses wagmi for wallet connection and viem for contract interaction.
 *
 * Usage:
 * ```tsx
 * const {
 *   registerEvidence,
 *   getEvidence,
 *   verifyEvidence,
 *   isLoading,
 *   error,
 * } = useEvidenceRegistry();
 * ```
 */

'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { keccak256, stringToBytes, type TransactionReceipt } from 'viem';

import {
  EVIDENCE_REGISTRY_ABI,
  getEvidenceRegistryAddress,
  validateContentHash,
  type OnChainEvidence,
} from '@/lib/contracts';
import { filecoinCalibration } from '@/lib/wagmi';

/**
 * Error types for contract operations
 */
export type ContractErrorType =
  | 'NOT_CONNECTED'
  | 'NO_CONTRACT_ADDRESS'
  | 'WRONG_NETWORK'
  | 'TRANSACTION_REJECTED'
  | 'TRANSACTION_FAILED'
  | 'EVIDENCE_NOT_FOUND'
  | 'EVIDENCE_ALREADY_EXISTS'
  | 'INVALID_INPUT'
  | 'UNKNOWN_ERROR';

export interface ContractError {
  type: ContractErrorType;
  message: string;
  details?: string;
}

/**
 * Registration result type
 */
export interface RegistrationResult {
  success: boolean;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
  timestamp?: bigint;
  error?: ContractError;
}

/**
 * Hook return type
 */
export interface UseEvidenceRegistryReturn {
  // State
  isLoading: boolean;
  error: ContractError | null;
  isContractAvailable: boolean;
  contractAddress: `0x${string}` | undefined;

  // Write operations
  registerEvidence: (params: {
    evidenceId: string;
    contentHash: string;
    pieceCid: string;
    providerAddress: string;
  }) => Promise<RegistrationResult>;

  verifyEvidence: (evidenceId: string) => Promise<RegistrationResult>;

  // Read operations
  getEvidence: (evidenceId: string) => Promise<OnChainEvidence | null>;
  evidenceExists: (evidenceId: string) => Promise<boolean>;
  isVerified: (evidenceId: string) => Promise<boolean>;
  verifyContentHash: (evidenceId: string, contentHash: string) => Promise<boolean>;
  getEvidenceCount: () => Promise<bigint>;

  // Utility
  clearError: () => void;
  uuidToBytes32: (uuid: string) => `0x${string}`;
}

/**
 * Convert a UUID string to bytes32 using keccak256
 * Uses UTF-8 encoding to match backend (ethers toUtf8Bytes)
 */
function uuidToBytes32(uuid: string): `0x${string}` {
  if (!uuid || typeof uuid !== 'string') {
    throw new Error('Invalid UUID: must be a non-empty string');
  }
  // stringToBytes encodes as UTF-8, matching ethers.toUtf8Bytes
  return keccak256(stringToBytes(uuid));
}

/**
 * Parse contract errors into user-friendly messages
 */
function parseContractError(error: unknown): ContractError {
  const errorString = String(error);

  // User rejected transaction
  if (
    errorString.includes('User rejected') ||
    errorString.includes('user rejected') ||
    errorString.includes('ACTION_REJECTED')
  ) {
    return {
      type: 'TRANSACTION_REJECTED',
      message: 'Transaction was rejected. Please try again.',
    };
  }

  // Contract-specific errors
  if (errorString.includes('EvidenceAlreadyExists')) {
    return {
      type: 'EVIDENCE_ALREADY_EXISTS',
      message: 'Evidence has already been registered on-chain.',
    };
  }

  if (errorString.includes('EvidenceNotFound')) {
    return {
      type: 'EVIDENCE_NOT_FOUND',
      message: 'Evidence not found on-chain.',
    };
  }

  if (errorString.includes('InvalidContentHash')) {
    return {
      type: 'INVALID_INPUT',
      message: 'Invalid content hash provided.',
    };
  }

  if (errorString.includes('InvalidPieceCid')) {
    return {
      type: 'INVALID_INPUT',
      message: 'Invalid PieceCID provided.',
    };
  }

  if (errorString.includes('InvalidProviderAddress')) {
    return {
      type: 'INVALID_INPUT',
      message: 'Invalid provider address provided.',
    };
  }

  if (errorString.includes('OnlyDeployer')) {
    return {
      type: 'TRANSACTION_FAILED',
      message: 'Only the contract admin can perform this action.',
    };
  }

  if (errorString.includes('EvidenceAlreadyVerified')) {
    return {
      type: 'TRANSACTION_FAILED',
      message: 'Evidence has already been verified.',
    };
  }

  // Transaction failed
  if (errorString.includes('execution reverted') || errorString.includes('revert')) {
    return {
      type: 'TRANSACTION_FAILED',
      message: 'Transaction failed. Please try again.',
      details: errorString.slice(0, 200),
    };
  }

  // Generic error
  return {
    type: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    details: errorString.slice(0, 200),
  };
}

/**
 * Hook for interacting with the EvidenceRegistry contract
 */
export function useEvidenceRegistry(): UseEvidenceRegistryReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ContractError | null>(null);

  // Wagmi hooks
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Get contract address
  const contractAddress = getEvidenceRegistryAddress();
  const isContractAvailable = Boolean(contractAddress && isConnected && walletClient);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Validate preconditions for contract operations
   */
  const validatePreconditions = useCallback(
    (requireWrite: boolean = false): ContractError | null => {
      if (!contractAddress) {
        return {
          type: 'NO_CONTRACT_ADDRESS',
          message: 'Contract address not configured. Please check environment settings.',
        };
      }

      if (requireWrite) {
        if (!isConnected || !address) {
          return {
            type: 'NOT_CONNECTED',
            message: 'Please connect your wallet to continue.',
          };
        }

        if (chainId !== filecoinCalibration.id) {
          return {
            type: 'WRONG_NETWORK',
            message: `Please switch to Filecoin Calibration network (Chain ID: ${filecoinCalibration.id}).`,
          };
        }

        if (!walletClient) {
          return {
            type: 'NOT_CONNECTED',
            message: 'Wallet not ready. Please try again.',
          };
        }
      }

      if (!publicClient) {
        return {
          type: 'NOT_CONNECTED',
          message: 'Network connection not available.',
        };
      }

      return null;
    },
    [contractAddress, isConnected, address, chainId, walletClient, publicClient]
  );

  /**
   * Register evidence on-chain
   */
  const registerEvidence = useCallback(
    async (params: {
      evidenceId: string;
      contentHash: string;
      pieceCid: string;
      providerAddress: string;
    }): Promise<RegistrationResult> => {
      const validationError = validatePreconditions(true);
      if (validationError) {
        setError(validationError);
        return { success: false, error: validationError };
      }

      // Validate inputs
      if (!params.evidenceId) {
        const err: ContractError = { type: 'INVALID_INPUT', message: 'Evidence ID is required.' };
        setError(err);
        return { success: false, error: err };
      }

      if (!validateContentHash(params.contentHash)) {
        const err: ContractError = { type: 'INVALID_INPUT', message: 'Invalid content hash format.' };
        setError(err);
        return { success: false, error: err };
      }

      if (!params.pieceCid) {
        const err: ContractError = { type: 'INVALID_INPUT', message: 'PieceCID is required.' };
        setError(err);
        return { success: false, error: err };
      }

      if (!params.providerAddress) {
        const err: ContractError = { type: 'INVALID_INPUT', message: 'Provider address is required.' };
        setError(err);
        return { success: false, error: err };
      }

      setIsLoading(true);
      setError(null);

      try {
        // Convert evidence ID to bytes32
        const evidenceIdBytes32 = uuidToBytes32(params.evidenceId);
        const contentHashBytes32 = params.contentHash as `0x${string}`;

        // Estimate gas first
        const gasEstimate = await publicClient!.estimateContractGas({
          address: contractAddress!,
          abi: EVIDENCE_REGISTRY_ABI,
          functionName: 'registerEvidence',
          args: [evidenceIdBytes32, contentHashBytes32, params.pieceCid, params.providerAddress],
          account: address,
        });

        // Add 20% buffer to gas estimate
        const gasLimit = (gasEstimate * 120n) / 100n;

        // Send transaction
        const hash = await walletClient!.writeContract({
          address: contractAddress!,
          abi: EVIDENCE_REGISTRY_ABI,
          functionName: 'registerEvidence',
          args: [evidenceIdBytes32, contentHashBytes32, params.pieceCid, params.providerAddress],
          gas: gasLimit,
        });

        // Wait for confirmation
        const receipt: TransactionReceipt = await publicClient!.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });

        if (receipt.status === 'reverted') {
          const err: ContractError = {
            type: 'TRANSACTION_FAILED',
            message: 'Transaction was reverted. Please try again.',
          };
          setError(err);
          return { success: false, error: err };
        }

        // Get block for timestamp
        const block = await publicClient!.getBlock({ blockNumber: receipt.blockNumber });

        return {
          success: true,
          txHash: hash,
          blockNumber: receipt.blockNumber,
          timestamp: block.timestamp,
        };
      } catch (err) {
        const contractError = parseContractError(err);
        setError(contractError);
        return { success: false, error: contractError };
      } finally {
        setIsLoading(false);
      }
    },
    [validatePreconditions, publicClient, walletClient, contractAddress, address]
  );

  /**
   * Verify evidence on-chain (admin only)
   */
  const verifyEvidence = useCallback(
    async (evidenceId: string): Promise<RegistrationResult> => {
      const validationError = validatePreconditions(true);
      if (validationError) {
        setError(validationError);
        return { success: false, error: validationError };
      }

      setIsLoading(true);
      setError(null);

      try {
        const evidenceIdBytes32 = uuidToBytes32(evidenceId);

        const hash = await walletClient!.writeContract({
          address: contractAddress!,
          abi: EVIDENCE_REGISTRY_ABI,
          functionName: 'verifyEvidence',
          args: [evidenceIdBytes32],
        });

        const receipt = await publicClient!.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });

        if (receipt.status === 'reverted') {
          const err: ContractError = {
            type: 'TRANSACTION_FAILED',
            message: 'Verification transaction was reverted.',
          };
          setError(err);
          return { success: false, error: err };
        }

        return {
          success: true,
          txHash: hash,
          blockNumber: receipt.blockNumber,
        };
      } catch (err) {
        const contractError = parseContractError(err);
        setError(contractError);
        return { success: false, error: contractError };
      } finally {
        setIsLoading(false);
      }
    },
    [validatePreconditions, publicClient, walletClient, contractAddress]
  );

  /**
   * Get evidence from contract
   */
  const getEvidence = useCallback(
    async (evidenceId: string): Promise<OnChainEvidence | null> => {
      const validationError = validatePreconditions(false);
      if (validationError) {
        setError(validationError);
        return null;
      }

      try {
        const evidenceIdBytes32 = uuidToBytes32(evidenceId);

        const result = await publicClient!.readContract({
          address: contractAddress!,
          abi: EVIDENCE_REGISTRY_ABI,
          functionName: 'getEvidence',
          args: [evidenceIdBytes32],
        });

        // Result is a struct returned as an object by viem
        const evidence = result as {
          evidenceId: `0x${string}`;
          contentHash: `0x${string}`;
          pieceCid: string;
          providerAddress: string;
          submitter: `0x${string}`;
          timestamp: bigint;
          blockNumber: bigint;
          verified: boolean;
        };

        return {
          evidenceId: evidence.evidenceId,
          contentHash: evidence.contentHash,
          pieceCid: evidence.pieceCid,
          providerAddress: evidence.providerAddress,
          submitter: evidence.submitter,
          timestamp: evidence.timestamp,
          blockNumber: evidence.blockNumber,
          verified: evidence.verified,
        };
      } catch (err) {
        const errorString = String(err);
        if (errorString.includes('EvidenceNotFound')) {
          return null;
        }
        const contractError = parseContractError(err);
        setError(contractError);
        return null;
      }
    },
    [validatePreconditions, publicClient, contractAddress]
  );

  /**
   * Check if evidence exists on-chain
   */
  const evidenceExists = useCallback(
    async (evidenceId: string): Promise<boolean> => {
      const validationError = validatePreconditions(false);
      if (validationError) {
        return false;
      }

      try {
        const evidenceIdBytes32 = uuidToBytes32(evidenceId);

        const exists = await publicClient!.readContract({
          address: contractAddress!,
          abi: EVIDENCE_REGISTRY_ABI,
          functionName: 'evidenceExists',
          args: [evidenceIdBytes32],
        });

        return exists as boolean;
      } catch {
        return false;
      }
    },
    [validatePreconditions, publicClient, contractAddress]
  );

  /**
   * Check if evidence is verified
   */
  const isVerified = useCallback(
    async (evidenceId: string): Promise<boolean> => {
      const validationError = validatePreconditions(false);
      if (validationError) {
        return false;
      }

      try {
        const evidenceIdBytes32 = uuidToBytes32(evidenceId);

        const verified = await publicClient!.readContract({
          address: contractAddress!,
          abi: EVIDENCE_REGISTRY_ABI,
          functionName: 'isVerified',
          args: [evidenceIdBytes32],
        });

        return verified as boolean;
      } catch {
        return false;
      }
    },
    [validatePreconditions, publicClient, contractAddress]
  );

  /**
   * Verify content hash matches on-chain record
   */
  const verifyContentHash = useCallback(
    async (evidenceId: string, contentHash: string): Promise<boolean> => {
      const validationError = validatePreconditions(false);
      if (validationError) {
        return false;
      }

      if (!validateContentHash(contentHash)) {
        return false;
      }

      try {
        const evidenceIdBytes32 = uuidToBytes32(evidenceId);

        const matches = await publicClient!.readContract({
          address: contractAddress!,
          abi: EVIDENCE_REGISTRY_ABI,
          functionName: 'verifyContentHash',
          args: [evidenceIdBytes32, contentHash as `0x${string}`],
        });

        return matches as boolean;
      } catch {
        return false;
      }
    },
    [validatePreconditions, publicClient, contractAddress]
  );

  /**
   * Get total evidence count
   */
  const getEvidenceCount = useCallback(async (): Promise<bigint> => {
    const validationError = validatePreconditions(false);
    if (validationError) {
      return 0n;
    }

    try {
      const count = await publicClient!.readContract({
        address: contractAddress!,
        abi: EVIDENCE_REGISTRY_ABI,
        functionName: 'evidenceCount',
      });

      return count as bigint;
    } catch {
      return 0n;
    }
  }, [validatePreconditions, publicClient, contractAddress]);

  return {
    // State
    isLoading,
    error,
    isContractAvailable,
    contractAddress,

    // Write operations
    registerEvidence,
    verifyEvidence,

    // Read operations
    getEvidence,
    evidenceExists,
    isVerified,
    verifyContentHash,
    getEvidenceCount,

    // Utility
    clearError,
    uuidToBytes32: uuidToBytes32,
  };
}

