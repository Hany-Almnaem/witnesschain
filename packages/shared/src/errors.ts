/**
 * WitnessChain Error Handling
 * Custom error classes and error codes for consistent error handling
 * 
 * Principles:
 * 1. User-facing messages are always safe and don't expose internals
 * 2. Technical messages are for logging only
 * 3. Error codes are consistent across frontend and backend
 */

/**
 * Base error class for all WitnessChain errors
 */
export class WitnessChainError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    userMessage: string,
    technicalMessage: string,
    details?: Record<string, unknown>
  ) {
    super(technicalMessage);
    this.name = 'WitnessChainError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }

  /**
   * Convert to a safe JSON representation for API responses
   */
  toJSON(): { error: string; code: string; message: string } {
    return {
      error: this.code,
      code: this.code,
      message: this.userMessage,
    };
  }
}

/**
 * Error codes organized by category
 */
export const ErrorCodes = {
  // Authentication errors (AUTH_0xx)
  AUTH_WALLET_NOT_CONNECTED: {
    code: 'AUTH_001',
    userMessage: 'Please connect your wallet to continue.',
  },
  AUTH_INVALID_PASSWORD: {
    code: 'AUTH_002',
    userMessage: 'Invalid password. Please try again.',
  },
  AUTH_SESSION_EXPIRED: {
    code: 'AUTH_003',
    userMessage: 'Your session has expired. Please sign in again.',
  },
  AUTH_UNAUTHORIZED: {
    code: 'AUTH_004',
    userMessage: 'You are not authorized to perform this action.',
  },
  AUTH_DID_INVALID: {
    code: 'AUTH_005',
    userMessage: 'Invalid identity. Please reconnect your wallet.',
  },

  // Storage errors (STORAGE_0xx)
  STORAGE_UPLOAD_FAILED: {
    code: 'STORAGE_001',
    userMessage: 'Failed to upload evidence. Please try again.',
  },
  STORAGE_INSUFFICIENT_FUNDS: {
    code: 'STORAGE_002',
    userMessage: 'Insufficient FIL balance for storage. Please fund your account.',
  },
  STORAGE_FILE_TOO_LARGE: {
    code: 'STORAGE_003',
    userMessage: 'File is too large. Maximum size is 200MB.',
  },
  STORAGE_DOWNLOAD_FAILED: {
    code: 'STORAGE_004',
    userMessage: 'Failed to retrieve evidence. Please try again.',
  },
  STORAGE_DEAL_FAILED: {
    code: 'STORAGE_005',
    userMessage: 'Storage deal creation failed. Please try again later.',
  },

  // Encryption errors (CRYPTO_0xx)
  CRYPTO_ENCRYPTION_FAILED: {
    code: 'CRYPTO_001',
    userMessage: 'Failed to encrypt file. Please try again.',
  },
  CRYPTO_DECRYPTION_FAILED: {
    code: 'CRYPTO_002',
    userMessage: 'Failed to decrypt file. You may not have access to this evidence.',
  },
  CRYPTO_KEY_GENERATION_FAILED: {
    code: 'CRYPTO_003',
    userMessage: 'Failed to generate encryption keys. Please try again.',
  },
  CRYPTO_KEY_STORAGE_FAILED: {
    code: 'CRYPTO_004',
    userMessage: 'Failed to store encryption keys securely.',
  },

  // Blockchain errors (FVM_0xx)
  FVM_TRANSACTION_FAILED: {
    code: 'FVM_001',
    userMessage: 'Blockchain transaction failed. Please try again.',
  },
  FVM_INSUFFICIENT_GAS: {
    code: 'FVM_002',
    userMessage: 'Insufficient gas for transaction. Please add funds to your wallet.',
  },
  FVM_CONTRACT_ERROR: {
    code: 'FVM_003',
    userMessage: 'Smart contract error. Please try again later.',
  },
  FVM_NETWORK_ERROR: {
    code: 'FVM_004',
    userMessage: 'Unable to connect to the blockchain. Please try again.',
  },

  // Validation errors (VALIDATION_0xx)
  VALIDATION_INVALID_INPUT: {
    code: 'VALIDATION_001',
    userMessage: 'Please check your input and try again.',
  },
  VALIDATION_FILE_TYPE_NOT_ALLOWED: {
    code: 'VALIDATION_002',
    userMessage: 'This file type is not supported.',
  },
  VALIDATION_MISSING_REQUIRED: {
    code: 'VALIDATION_003',
    userMessage: 'Please fill in all required fields.',
  },
  VALIDATION_INVALID_FORMAT: {
    code: 'VALIDATION_004',
    userMessage: 'Invalid format. Please check your input.',
  },

  // Network errors (NETWORK_0xx)
  NETWORK_OFFLINE: {
    code: 'NETWORK_001',
    userMessage: 'You appear to be offline. Please check your connection.',
  },
  NETWORK_TIMEOUT: {
    code: 'NETWORK_002',
    userMessage: 'Request timed out. Please try again.',
  },
  NETWORK_SERVER_ERROR: {
    code: 'NETWORK_003',
    userMessage: 'Server error. Please try again later.',
  },

  // Evidence errors (EVIDENCE_0xx)
  EVIDENCE_NOT_FOUND: {
    code: 'EVIDENCE_001',
    userMessage: 'Evidence not found.',
  },
  EVIDENCE_ALREADY_EXISTS: {
    code: 'EVIDENCE_002',
    userMessage: 'This evidence has already been submitted.',
  },
  EVIDENCE_ACCESS_DENIED: {
    code: 'EVIDENCE_003',
    userMessage: 'You do not have access to this evidence.',
  },

  // UCAN errors (UCAN_0xx)
  UCAN_INVALID_TOKEN: {
    code: 'UCAN_001',
    userMessage: 'Invalid access token. Please sign in again.',
  },
  UCAN_EXPIRED: {
    code: 'UCAN_002',
    userMessage: 'Your access has expired. Please request new permissions.',
  },
  UCAN_INSUFFICIENT_PERMISSIONS: {
    code: 'UCAN_003',
    userMessage: 'You do not have permission for this action.',
  },
} as const;

/**
 * Factory functions for creating specific errors
 */
export const createError = {
  auth: {
    walletNotConnected: () =>
      new WitnessChainError(
        ErrorCodes.AUTH_WALLET_NOT_CONNECTED.code,
        ErrorCodes.AUTH_WALLET_NOT_CONNECTED.userMessage,
        'Wallet not connected'
      ),
    invalidPassword: () =>
      new WitnessChainError(
        ErrorCodes.AUTH_INVALID_PASSWORD.code,
        ErrorCodes.AUTH_INVALID_PASSWORD.userMessage,
        'Password verification failed'
      ),
    sessionExpired: () =>
      new WitnessChainError(
        ErrorCodes.AUTH_SESSION_EXPIRED.code,
        ErrorCodes.AUTH_SESSION_EXPIRED.userMessage,
        'Session expired or invalid'
      ),
    unauthorized: () =>
      new WitnessChainError(
        ErrorCodes.AUTH_UNAUTHORIZED.code,
        ErrorCodes.AUTH_UNAUTHORIZED.userMessage,
        'Unauthorized access attempt'
      ),
  },

  storage: {
    uploadFailed: (details?: Record<string, unknown>) =>
      new WitnessChainError(
        ErrorCodes.STORAGE_UPLOAD_FAILED.code,
        ErrorCodes.STORAGE_UPLOAD_FAILED.userMessage,
        'Upload to Filecoin failed',
        details
      ),
    insufficientFunds: () =>
      new WitnessChainError(
        ErrorCodes.STORAGE_INSUFFICIENT_FUNDS.code,
        ErrorCodes.STORAGE_INSUFFICIENT_FUNDS.userMessage,
        'Insufficient FIL for storage deal'
      ),
    fileTooLarge: (size: number) =>
      new WitnessChainError(
        ErrorCodes.STORAGE_FILE_TOO_LARGE.code,
        ErrorCodes.STORAGE_FILE_TOO_LARGE.userMessage,
        `File size ${size} exceeds limit`,
        { size }
      ),
  },

  crypto: {
    encryptionFailed: () =>
      new WitnessChainError(
        ErrorCodes.CRYPTO_ENCRYPTION_FAILED.code,
        ErrorCodes.CRYPTO_ENCRYPTION_FAILED.userMessage,
        'Encryption operation failed'
      ),
    decryptionFailed: () =>
      new WitnessChainError(
        ErrorCodes.CRYPTO_DECRYPTION_FAILED.code,
        ErrorCodes.CRYPTO_DECRYPTION_FAILED.userMessage,
        'Decryption operation failed'
      ),
  },

  validation: {
    invalidInput: (field?: string) =>
      new WitnessChainError(
        ErrorCodes.VALIDATION_INVALID_INPUT.code,
        ErrorCodes.VALIDATION_INVALID_INPUT.userMessage,
        `Invalid input${field ? `: ${field}` : ''}`,
        field ? { field } : undefined
      ),
    fileTypeNotAllowed: (type: string) =>
      new WitnessChainError(
        ErrorCodes.VALIDATION_FILE_TYPE_NOT_ALLOWED.code,
        ErrorCodes.VALIDATION_FILE_TYPE_NOT_ALLOWED.userMessage,
        `File type not allowed: ${type}`,
        { type }
      ),
  },

  evidence: {
    notFound: (id?: string) =>
      new WitnessChainError(
        ErrorCodes.EVIDENCE_NOT_FOUND.code,
        ErrorCodes.EVIDENCE_NOT_FOUND.userMessage,
        `Evidence not found${id ? `: ${id}` : ''}`,
        id ? { id } : undefined
      ),
    accessDenied: () =>
      new WitnessChainError(
        ErrorCodes.EVIDENCE_ACCESS_DENIED.code,
        ErrorCodes.EVIDENCE_ACCESS_DENIED.userMessage,
        'Access to evidence denied'
      ),
  },

  network: {
    offline: () =>
      new WitnessChainError(
        ErrorCodes.NETWORK_OFFLINE.code,
        ErrorCodes.NETWORK_OFFLINE.userMessage,
        'Network connectivity lost'
      ),
    timeout: () =>
      new WitnessChainError(
        ErrorCodes.NETWORK_TIMEOUT.code,
        ErrorCodes.NETWORK_TIMEOUT.userMessage,
        'Request timed out'
      ),
    serverError: () =>
      new WitnessChainError(
        ErrorCodes.NETWORK_SERVER_ERROR.code,
        ErrorCodes.NETWORK_SERVER_ERROR.userMessage,
        'Server returned an error'
      ),
  },
} as const;

/**
 * Check if an error is a WitnessChainError
 */
export function isWitnessChainError(error: unknown): error is WitnessChainError {
  return error instanceof WitnessChainError;
}

/**
 * Get user-safe error message from any error
 * Never exposes internal details
 */
export function getUserMessage(error: unknown): string {
  if (isWitnessChainError(error)) {
    return error.userMessage;
  }

  // Default message for unknown errors
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): string {
  if (isWitnessChainError(error)) {
    return error.code;
  }

  return 'UNKNOWN_ERROR';
}
