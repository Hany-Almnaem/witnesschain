/**
 * Type Definitions
 * Core types used across the application
 */

import type {
  ALLOWED_FILE_TYPES,
  EVIDENCE_CATEGORIES,
  SOURCE_TYPES,
  CONTENT_WARNINGS,
  EVIDENCE_STATUS,
  VERIFICATION_STATUS,
  ACCESS_LOG_ACTIONS,
} from '../constants.js';

/** Allowed file MIME type */
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

/** Evidence category */
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

/** Evidence source type */
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Content warning type */
export type ContentWarning = (typeof CONTENT_WARNINGS)[number];

/** Evidence status */
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[number];

/** Verification status */
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

/** Access log action */
export type AccessLogAction = (typeof ACCESS_LOG_ACTIONS)[number];

/** User entity */
export interface User {
  id: string; // DID string (did:key:...)
  publicKey: string;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Location information for evidence */
export interface EvidenceLocation {
  description?: string;
  latitude?: number;
  longitude?: number;
}

/** Date information for evidence */
export interface EvidenceDate {
  occurred?: string; // ISO datetime
  approximate?: string;
}

/** Evidence source information */
export interface EvidenceSource {
  type: SourceType;
  name?: string;
}

/** Evidence entity */
export interface Evidence {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: EvidenceCategory;
  pieceCid: string;
  dataSetId?: string;
  providerAddress?: string;
  encryptedKey: string;
  nonce: string;
  fileSize: number;
  mimeType: string;
  contentHash: string;
  txHash?: string;
  blockNumber?: number;
  onChainTimestamp?: number;
  filPaid?: string;
  paymentTxHash?: string;
  status: EvidenceStatus;
  ucanToken?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Verification entity */
export interface Verification {
  id: string;
  evidenceId: string;
  status: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  notes?: string;
  createdAt: Date;
}

/** Access log entity */
export interface AccessLog {
  id: string;
  evidenceId: string;
  userId: string;
  action: AccessLogAction;
  ucanToken?: string;
  createdAt: Date;
}

/** Filecoin storage result */
export interface FilecoinStorageResult {
  pieceCid: string;
  dataSetId: string;
  providerAddress: string;
  filPaid: string;
}

/** FVM transaction result */
export interface FvmTransactionResult {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  gasUsed: string;
}

/** Session information (stored in sessionStorage) */
export interface Session {
  did: string;
  walletAddress: string;
  createdAt: number;
  expiresAt: number;
}

/** Encrypted key record (stored in IndexedDB) */
export interface EncryptedKeyRecord {
  did: string;
  salt: number[];
  iv: number[];
  encryptedKey: number[];
  createdAt: number;
  /** SHA-256 checksum of encrypted data for integrity verification */
  checksum?: string;
}

/** API error response */
export interface ApiErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** API success response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorResponse;
}

/** Health check response */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected';
    synapse: 'connected' | 'disconnected';
    fvm: 'connected' | 'disconnected';
  };
}
