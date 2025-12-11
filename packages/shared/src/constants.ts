/**
 * WitnessChain Global Constants
 * Shared constants used across the application
 */

/** Filecoin network configuration */
export const FILECOIN_NETWORKS = {
  CALIBRATION: {
    chainId: 314159,
    name: 'filecoin-calibration',
    rpcUrl: 'https://api.calibration.node.glif.io/rpc/v1',
    explorerUrl: 'https://calibration.filfox.info',
    faucetUrl: 'https://faucet.calibration.fildev.network',
  },
  MAINNET: {
    chainId: 314,
    name: 'filecoin-mainnet',
    rpcUrl: 'https://api.node.glif.io/rpc/v1',
    explorerUrl: 'https://filfox.info',
    faucetUrl: null,
  },
} as const;

/** Allowed file types for evidence uploads */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
  'text/plain',
] as const;

/** Evidence categories for classification */
export const EVIDENCE_CATEGORIES = [
  'human_rights_violation',
  'war_crime',
  'environmental_crime',
  'corruption',
  'police_brutality',
  'censorship',
  'discrimination',
  'other',
] as const;

/** Evidence source types */
export const SOURCE_TYPES = [
  'witness',
  'organization',
  'anonymous',
  'media',
] as const;

/** Content warning types */
export const CONTENT_WARNINGS = [
  'violence',
  'death',
  'abuse',
  'graphic',
  'disturbing',
] as const;

/** Evidence status values */
export const EVIDENCE_STATUS = [
  'pending',
  'uploading',
  'stored',
  'timestamped',
  'verified',
  'rejected',
] as const;

/** Verification status values */
export const VERIFICATION_STATUS = [
  'pending',
  'approved',
  'rejected',
] as const;

/** Access log action types */
export const ACCESS_LOG_ACTIONS = [
  'view',
  'download',
  'share',
  'revoke',
] as const;

/** File size limits */
export const FILE_SIZE_LIMITS = {
  MIN_BYTES: 127,
  MAX_BYTES: 200 * 1024 * 1024, // 200MB
} as const;

/** Encryption configuration */
export const ENCRYPTION_CONFIG = {
  PBKDF2_ITERATIONS: 100000,
  KEY_LENGTH: 256,
  ALGORITHM: 'AES-GCM',
  HASH: 'SHA-256',
} as const;

/** DID configuration */
export const DID_CONFIG = {
  METHOD: 'key',
  KEY_TYPE: 'ed25519',
} as const;

/** IndexedDB configuration */
export const INDEXED_DB_CONFIG = {
  DB_NAME: 'witnesschain-keys',
  STORE_NAME: 'encrypted-keys',
  VERSION: 1,
} as const;

/** API configuration */
export const API_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
} as const;
