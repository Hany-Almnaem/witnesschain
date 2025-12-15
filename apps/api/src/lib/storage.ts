/**
 * Filecoin Storage Service
 *
 * High-level storage operations for evidence files using Synapse SDK.
 * This service handles:
 * - File upload with metadata
 * - File retrieval by CID
 * - Progress tracking via callbacks
 *
 * IMPORTANT:
 * - All data is assumed to be already encrypted by the client
 * - CIDs are validated before storage and after retrieval
 * - Errors are translated at this boundary
 */

import { FILE_SIZE_LIMITS } from '@witnesschain/shared';

import { validateCid, sanitizeCidForLog } from './cid-validation.js';
import {
  StorageError,
  StorageErrorCode,
  translateStorageError,
  createEmptyFileError,
  createInvalidCidError,
} from './storage-errors.js';
import { getSynapseClient } from './synapse.js';


/**
 * Result of a successful file upload
 */
export interface UploadResult {
  /** Filecoin PieceCID - unique identifier for the stored data */
  pieceCid: string;
  /** Synapse data set ID */
  dataSetId: string;
  /** Storage provider address */
  providerAddress: string;
  /** Amount of FIL paid for storage (as string) - currently not available from SDK */
  filPaid: string;
  /** Size of uploaded data in bytes */
  uploadedBytes: number;
}

/**
 * Upload progress callback parameters
 */
export interface UploadProgressInfo {
  /** Current stage of upload */
  stage: 'preparing' | 'uploading' | 'confirming' | 'complete';
  /** Progress percentage (0-100) */
  progress: number;
  /** Human-readable message */
  message: string;
  /** Bytes uploaded so far */
  bytesUploaded?: number;
  /** Total bytes to upload */
  totalBytes?: number;
}

/**
 * Upload progress callback type
 */
export type UploadProgressCallback = (info: UploadProgressInfo) => void;

/**
 * Upload options
 */
export interface UploadOptions {
  /** Evidence ID for tracking */
  evidenceId: string;
  /** Content hash for verification (hex string with 0x prefix) */
  contentHash: string;
  /** Optional progress callback */
  onProgress?: UploadProgressCallback;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
}

/**
 * Upload encrypted file data to Filecoin
 *
 * @param encryptedData - The encrypted file data to store
 * @param options - Upload options including tracking and progress
 * @returns Upload result with CID and payment info
 * @throws {StorageError} On upload failure
 */
export async function uploadToFilecoin(
  encryptedData: Uint8Array,
  options: UploadOptions
): Promise<UploadResult> {
  const { evidenceId, contentHash, onProgress } = options;

  // Validate input
  if (!encryptedData || encryptedData.length === 0) {
    throw createEmptyFileError();
  }

  if (encryptedData.length > FILE_SIZE_LIMITS.MAX_BYTES) {
    throw new StorageError(
      StorageErrorCode.FILE_TOO_LARGE,
      `File exceeds maximum size of ${FILE_SIZE_LIMITS.MAX_BYTES / (1024 * 1024)}MB`,
      `File size ${encryptedData.length} exceeds limit ${FILE_SIZE_LIMITS.MAX_BYTES}`,
      { size: encryptedData.length, limit: FILE_SIZE_LIMITS.MAX_BYTES }
    );
  }

  // Report preparation stage
  onProgress?.({
    stage: 'preparing',
    progress: 0,
    message: 'Preparing upload...',
    totalBytes: encryptedData.length,
  });

  try {
    const client = await getSynapseClient();

    console.info(`[Storage] Starting upload for evidence: ${evidenceId}`);
    console.info(`[Storage] Data size: ${encryptedData.length} bytes`);
    console.info(`[Storage] Content hash: ${contentHash.substring(0, 20)}...`);

    // Report uploading stage
    onProgress?.({
      stage: 'uploading',
      progress: 10,
      message: 'Uploading to Filecoin...',
      bytesUploaded: 0,
      totalBytes: encryptedData.length,
    });

    // Create storage context
    const context = await client.storage.createContext({
      metadata: {
        evidenceId,
        contentHash,
        uploadedAt: new Date().toISOString(),
        platform: 'witnesschain',
      },
    });

    // Upload with progress tracking
    let lastProgress = 10;
    const result = await context.upload(encryptedData, {
      metadata: {
        evidenceId,
        contentHash,
      },
      onProgress: (bytesUploaded: number) => {
        // Calculate progress (10-80% range for upload)
        const uploadProgress = Math.min(
          80,
          10 + Math.floor((bytesUploaded / encryptedData.length) * 70)
        );
        if (uploadProgress > lastProgress) {
          lastProgress = uploadProgress;
          onProgress?.({
            stage: 'uploading',
            progress: uploadProgress,
            message: 'Uploading to Filecoin...',
            bytesUploaded,
            totalBytes: encryptedData.length,
          });
        }
      },
    });

    // Convert PieceCID to string for validation and storage
    const pieceCidString = result.pieceCid.toString();

    // Validate the returned CID
    const cidValidation = validateCid(pieceCidString);
    if (!cidValidation.isValid) {
      console.error(
        `[Storage] Invalid CID returned from SDK: ${sanitizeCidForLog(pieceCidString)}`
      );
      throw new StorageError(
        StorageErrorCode.INVALID_CID,
        'Storage returned invalid identifier. Please try again.',
        `SDK returned invalid CID: ${cidValidation.error}`,
        { cid: sanitizeCidForLog(pieceCidString) }
      );
    }

    // Report confirming stage
    onProgress?.({
      stage: 'confirming',
      progress: 80,
      message: 'Confirming storage deal...',
      bytesUploaded: encryptedData.length,
      totalBytes: encryptedData.length,
    });

    // Get provider and dataset info from context
    const providerAddress = context.serviceProvider ?? '';
    const dataSetId = context.dataSetId?.toString() ?? '';

    console.info(`[Storage] Upload complete for evidence: ${evidenceId}`);
    console.info(`[Storage] PieceCID: ${sanitizeCidForLog(pieceCidString)}`);
    console.info(`[Storage] Provider: ${providerAddress}`);
    console.info(`[Storage] DataSetId: ${dataSetId}`);

    // Report complete
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Upload complete',
      bytesUploaded: encryptedData.length,
      totalBytes: encryptedData.length,
    });

    return {
      pieceCid: pieceCidString,
      dataSetId,
      providerAddress,
      filPaid: '0', // Payment info not directly available from SDK upload result
      uploadedBytes: result.size,
    };
  } catch (error) {
    // Already a StorageError - re-throw
    if (error instanceof StorageError) {
      throw error;
    }

    // Translate SDK errors at the boundary
    throw translateStorageError(error);
  }
}

/**
 * Retrieve options
 */
export interface RetrieveOptions {
  /** Timeout in milliseconds (default: 2 minutes) */
  timeout?: number;
}

/**
 * Retrieve encrypted file data from Filecoin
 *
 * @param pieceCid - The PieceCID of the stored data
 * @param options - Retrieval options
 * @returns The encrypted file data
 * @throws {StorageError} On retrieval failure
 */
export async function retrieveFromFilecoin(
  pieceCid: string,
  _options?: RetrieveOptions
): Promise<Uint8Array> {
  // Validate CID before making request
  const cidValidation = validateCid(pieceCid);
  if (!cidValidation.isValid) {
    throw createInvalidCidError(pieceCid);
  }

  console.info(`[Storage] Retrieving data for CID: ${sanitizeCidForLog(pieceCid)}`);

  try {
    const client = await getSynapseClient();

    // Retrieve data from Filecoin using the main client download method
    const data = await client.download(pieceCid);

    if (!data || data.length === 0) {
      throw new StorageError(
        StorageErrorCode.NOT_FOUND,
        'Evidence not found in storage.',
        `Empty response for CID: ${sanitizeCidForLog(pieceCid)}`
      );
    }

    console.info(
      `[Storage] Retrieved ${data.length} bytes for CID: ${sanitizeCidForLog(pieceCid)}`
    );

    return data;
  } catch (error) {
    // Already a StorageError - re-throw
    if (error instanceof StorageError) {
      throw error;
    }

    // Translate SDK errors at the boundary
    throw translateStorageError(error);
  }
}

/**
 * Check if data exists for a given CID
 *
 * @param pieceCid - The PieceCID to check
 * @returns True if data exists, false otherwise
 */
export async function existsInFilecoin(pieceCid: string): Promise<boolean> {
  const cidValidation = validateCid(pieceCid);
  if (!cidValidation.isValid) {
    return false;
  }

  try {
    const client = await getSynapseClient();
    // Create a context and check piece status
    const context = await client.storage.getDefaultContext();
    const status = await context.pieceStatus(pieceCid);
    return status.exists;
  } catch {
    return false;
  }
}

/**
 * Get information about a stored file
 */
export interface StoredFileInfo {
  pieceCid: string;
  exists: boolean;
  retrievalUrl?: string | null;
}

/**
 * Get metadata about a stored file
 *
 * @param pieceCid - The PieceCID of the stored data
 * @returns File info or null if not found
 */
export async function getStoredFileInfo(
  pieceCid: string
): Promise<StoredFileInfo | null> {
  const cidValidation = validateCid(pieceCid);
  if (!cidValidation.isValid) {
    return null;
  }

  try {
    const client = await getSynapseClient();
    const context = await client.storage.getDefaultContext();
    const status = await context.pieceStatus(pieceCid);

    return {
      pieceCid,
      exists: status.exists,
      retrievalUrl: status.retrievalUrl,
    };
  } catch {
    return null;
  }
}
