/**
 * Storage Error Handling
 *
 * Provides storage-specific error types and translation utilities.
 * All errors from Synapse SDK and storage operations are translated
 * at the storage boundary to provide consistent, user-safe error messages.
 *
 * IMPORTANT: Technical details are logged but never exposed to clients.
 */

/**
 * Storage-specific error codes
 */
export enum StorageErrorCode {
  // Client configuration errors
  CLIENT_NOT_CONFIGURED = 'STORAGE_CLIENT_NOT_CONFIGURED',
  INSUFFICIENT_FUNDS = 'STORAGE_INSUFFICIENT_FUNDS',

  // Upload errors
  UPLOAD_FAILED = 'STORAGE_UPLOAD_FAILED',
  UPLOAD_TIMEOUT = 'STORAGE_UPLOAD_TIMEOUT',
  FILE_TOO_LARGE = 'STORAGE_FILE_TOO_LARGE',
  EMPTY_FILE = 'STORAGE_EMPTY_FILE',

  // Retrieval errors
  RETRIEVAL_FAILED = 'STORAGE_RETRIEVAL_FAILED',
  NOT_FOUND = 'STORAGE_NOT_FOUND',
  RETRIEVAL_TIMEOUT = 'STORAGE_RETRIEVAL_TIMEOUT',

  // Deal errors
  DEAL_FAILED = 'STORAGE_DEAL_FAILED',
  DEAL_TIMEOUT = 'STORAGE_DEAL_TIMEOUT',

  // Validation errors
  INVALID_CID = 'STORAGE_INVALID_CID',
  MISSING_CID = 'STORAGE_MISSING_CID',
  INVALID_DATA = 'STORAGE_INVALID_DATA',

  // Network errors
  NETWORK_ERROR = 'STORAGE_NETWORK_ERROR',
  PROVIDER_UNAVAILABLE = 'STORAGE_PROVIDER_UNAVAILABLE',

  // Unknown errors
  UNKNOWN = 'STORAGE_UNKNOWN_ERROR',
}

/**
 * User-safe messages for each error code
 */
const USER_MESSAGES: Record<StorageErrorCode, string> = {
  [StorageErrorCode.CLIENT_NOT_CONFIGURED]:
    'Storage service is not properly configured. Please contact support.',
  [StorageErrorCode.INSUFFICIENT_FUNDS]:
    'Insufficient funds for storage. Please try again later.',
  [StorageErrorCode.UPLOAD_FAILED]:
    'Failed to upload evidence. Please try again.',
  [StorageErrorCode.UPLOAD_TIMEOUT]:
    'Upload timed out. Please check your connection and try again.',
  [StorageErrorCode.FILE_TOO_LARGE]:
    'File is too large. Maximum size is 200MB.',
  [StorageErrorCode.EMPTY_FILE]:
    'Cannot store empty file.',
  [StorageErrorCode.RETRIEVAL_FAILED]:
    'Failed to retrieve evidence. Please try again.',
  [StorageErrorCode.NOT_FOUND]:
    'Evidence not found in storage.',
  [StorageErrorCode.RETRIEVAL_TIMEOUT]:
    'Retrieval timed out. Please try again.',
  [StorageErrorCode.DEAL_FAILED]:
    'Storage deal failed. Please try again later.',
  [StorageErrorCode.DEAL_TIMEOUT]:
    'Storage deal timed out. Please try again.',
  [StorageErrorCode.INVALID_CID]:
    'Invalid storage identifier.',
  [StorageErrorCode.MISSING_CID]:
    'Storage provider did not return an identifier. Please try again.',
  [StorageErrorCode.INVALID_DATA]:
    'Invalid data format.',
  [StorageErrorCode.NETWORK_ERROR]:
    'Network error. Please check your connection.',
  [StorageErrorCode.PROVIDER_UNAVAILABLE]:
    'Storage provider unavailable. Please try again later.',
  [StorageErrorCode.UNKNOWN]:
    'An unexpected storage error occurred. Please try again.',
};

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: StorageErrorCode,
    userMessage: string,
    technicalMessage: string,
    details?: Record<string, unknown>
  ) {
    super(technicalMessage);
    this.name = 'StorageError';
    this.code = code;
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
    this.details = details;
  }

  /**
   * Convert to API response format
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
 * Translate unknown errors from Synapse SDK to StorageError
 *
 * This function is the single point of translation for all storage errors.
 * Technical details are logged but never exposed to clients.
 */
export function translateStorageError(error: unknown): StorageError {
  // Already a StorageError - return as-is
  if (error instanceof StorageError) {
    return error;
  }

  // Log the original error for debugging
  console.error('[Storage] Error occurred:', error);

  // Handle known error patterns from Synapse SDK
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Insufficient funds
    if (
      message.includes('insufficient') ||
      message.includes('balance') ||
      message.includes('funds')
    ) {
      return new StorageError(
        StorageErrorCode.INSUFFICIENT_FUNDS,
        USER_MESSAGES[StorageErrorCode.INSUFFICIENT_FUNDS],
        error.message
      );
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return new StorageError(
        StorageErrorCode.UPLOAD_TIMEOUT,
        USER_MESSAGES[StorageErrorCode.UPLOAD_TIMEOUT],
        error.message
      );
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return new StorageError(
        StorageErrorCode.NETWORK_ERROR,
        USER_MESSAGES[StorageErrorCode.NETWORK_ERROR],
        error.message
      );
    }

    // Not found
    if (message.includes('not found') || message.includes('404')) {
      return new StorageError(
        StorageErrorCode.NOT_FOUND,
        USER_MESSAGES[StorageErrorCode.NOT_FOUND],
        error.message
      );
    }

    // Provider unavailable
    if (
      message.includes('provider') ||
      message.includes('unavailable') ||
      message.includes('503')
    ) {
      return new StorageError(
        StorageErrorCode.PROVIDER_UNAVAILABLE,
        USER_MESSAGES[StorageErrorCode.PROVIDER_UNAVAILABLE],
        error.message
      );
    }

    // Deal errors
    if (message.includes('deal')) {
      return new StorageError(
        StorageErrorCode.DEAL_FAILED,
        USER_MESSAGES[StorageErrorCode.DEAL_FAILED],
        error.message
      );
    }

    // CID validation errors - be specific to avoid false positives
    // Only match when "cid" is mentioned, or specific invalid CID patterns
    // Note: message is already lowercased above
    if (
      message.includes('piececid') || // pieceCid lowercased
      message.includes('piece cid') ||
      message.includes('invalid cid') ||
      (message.includes('cid') && message.includes('invalid'))
    ) {
      return new StorageError(
        StorageErrorCode.INVALID_CID,
        USER_MESSAGES[StorageErrorCode.INVALID_CID],
        error.message
      );
    }

    // Upload failed (catch-all for upload-specific errors before falling through)
    if (message.includes('upload') && message.includes('fail')) {
      return new StorageError(
        StorageErrorCode.UPLOAD_FAILED,
        USER_MESSAGES[StorageErrorCode.UPLOAD_FAILED],
        error.message
      );
    }
  }

  // Unknown error - provide generic message
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error';

  return new StorageError(
    StorageErrorCode.UNKNOWN,
    USER_MESSAGES[StorageErrorCode.UNKNOWN],
    errorMessage
  );
}

/**
 * Create error for empty file
 */
export function createEmptyFileError(): StorageError {
  return new StorageError(
    StorageErrorCode.EMPTY_FILE,
    USER_MESSAGES[StorageErrorCode.EMPTY_FILE],
    'Attempted to store empty file'
  );
}

/**
 * Create error for file too large
 */
export function createFileTooLargeError(
  actualSize: number,
  maxSize: number
): StorageError {
  return new StorageError(
    StorageErrorCode.FILE_TOO_LARGE,
    USER_MESSAGES[StorageErrorCode.FILE_TOO_LARGE],
    `File size ${actualSize} exceeds maximum ${maxSize}`,
    { actualSize, maxSize }
  );
}

/**
 * Create error for invalid CID format
 */
export function createInvalidCidError(cid: string): StorageError {
  return new StorageError(
    StorageErrorCode.INVALID_CID,
    USER_MESSAGES[StorageErrorCode.INVALID_CID],
    `Invalid CID format: ${cid.substring(0, 20)}...`,
    { cidPrefix: cid.substring(0, 20) }
  );
}

/**
 * Create error for missing CID (SDK returned null/undefined)
 */
export function createMissingCidError(evidenceId: string): StorageError {
  return new StorageError(
    StorageErrorCode.MISSING_CID,
    USER_MESSAGES[StorageErrorCode.MISSING_CID],
    `SDK returned null/undefined pieceCid for evidence: ${evidenceId.substring(0, 8)}...`,
    { evidenceIdPrefix: evidenceId.substring(0, 8) }
  );
}

/**
 * Check if an error is a StorageError
 */
export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}
