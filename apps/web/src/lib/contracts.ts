/**
 * Smart Contract Configuration
 *
 * Contains the EvidenceRegistry ABI and address configuration.
 * The contract provides immutable on-chain timestamping for evidence.
 */

import { getContractAddress } from './env';

/**
 * EvidenceRegistry contract ABI
 * Minimal ABI containing only the functions we need
 */
export const EVIDENCE_REGISTRY_ABI = [
  // Events
  {
    type: 'event',
    name: 'EvidenceRegistered',
    inputs: [
      { name: 'evidenceId', type: 'bytes32', indexed: true },
      { name: 'contentHash', type: 'bytes32', indexed: true },
      { name: 'pieceCid', type: 'string', indexed: false },
      { name: 'providerAddress', type: 'string', indexed: false },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'blockNumber', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EvidenceVerified',
    inputs: [
      { name: 'evidenceId', type: 'bytes32', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  // Errors
  { type: 'error', name: 'EvidenceAlreadyExists', inputs: [{ name: 'evidenceId', type: 'bytes32' }] },
  { type: 'error', name: 'EvidenceAlreadyVerified', inputs: [{ name: 'evidenceId', type: 'bytes32' }] },
  { type: 'error', name: 'EvidenceNotFound', inputs: [{ name: 'evidenceId', type: 'bytes32' }] },
  { type: 'error', name: 'InvalidContentHash', inputs: [] },
  { type: 'error', name: 'InvalidPieceCid', inputs: [] },
  { type: 'error', name: 'InvalidProviderAddress', inputs: [] },
  { type: 'error', name: 'OnlyDeployer', inputs: [] },
  // Read functions
  {
    type: 'function',
    name: 'VERSION',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'deployer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'evidenceCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'evidenceExists',
    stateMutability: 'view',
    inputs: [{ name: 'evidenceId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getEvidence',
    stateMutability: 'view',
    inputs: [{ name: 'evidenceId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'evidenceId', type: 'bytes32' },
          { name: 'contentHash', type: 'bytes32' },
          { name: 'pieceCid', type: 'string' },
          { name: 'providerAddress', type: 'string' },
          { name: 'submitter', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'blockNumber', type: 'uint256' },
          { name: 'verified', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getSubmitter',
    stateMutability: 'view',
    inputs: [{ name: 'evidenceId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'isVerified',
    stateMutability: 'view',
    inputs: [{ name: 'evidenceId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'verifyContentHash',
    stateMutability: 'view',
    inputs: [
      { name: 'evidenceId', type: 'bytes32' },
      { name: 'contentHash', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
  // Write functions
  {
    type: 'function',
    name: 'registerEvidence',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'evidenceId', type: 'bytes32' },
      { name: 'contentHash', type: 'bytes32' },
      { name: 'pieceCid', type: 'string' },
      { name: 'providerAddress', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'verifyEvidence',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'evidenceId', type: 'bytes32' }],
    outputs: [],
  },
] as const;

/**
 * Get the EvidenceRegistry contract address
 * Returns undefined if not configured
 */
export function getEvidenceRegistryAddress(): `0x${string}` | undefined {
  const address = getContractAddress();
  if (!address) return undefined;

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.warn('[Contracts] Invalid contract address format:', address);
    return undefined;
  }

  return address as `0x${string}`;
}

/**
 * On-chain evidence record type (matches contract struct)
 */
export interface OnChainEvidence {
  evidenceId: `0x${string}`;
  contentHash: `0x${string}`;
  pieceCid: string;
  providerAddress: string;
  submitter: `0x${string}`;
  timestamp: bigint;
  blockNumber: bigint;
  verified: boolean;
}

/**
 * Evidence registration parameters
 */
export interface RegisterEvidenceParams {
  evidenceId: string;
  contentHash: string;
  pieceCid: string;
  providerAddress: string;
}

/**
 * Convert a UUID string to bytes32 for contract calls
 * Uses keccak256 hash of the UUID string
 */
export function uuidToBytes32(uuid: string): `0x${string}` {
  // We'll use viem's keccak256 - this is imported where needed
  // For now just validate the format
  if (!uuid || typeof uuid !== 'string') {
    throw new Error('Invalid UUID: must be a non-empty string');
  }
  return `0x${uuid.replace(/-/g, '').padEnd(64, '0')}` as `0x${string}`;
}

/**
 * Validate a content hash is in the correct format
 */
export function validateContentHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

