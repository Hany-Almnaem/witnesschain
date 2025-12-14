/**
 * File Encryption Module
 *
 * Implements symmetric encryption for evidence files using tweetnacl.
 * Each file gets a unique nonce that is stored alongside the encrypted data.
 *
 * Encryption scheme:
 * 1. Generate random symmetric key for the file (secretbox.keyLength = 32 bytes)
 * 2. Generate unique nonce for file encryption (secretbox.nonceLength = 24 bytes)
 * 3. Encrypt file content with symmetric key using XSalsa20-Poly1305
 * 4. Encrypt symmetric key with recipient's X25519 public key using box
 * 5. Return encrypted data, encrypted key, and nonces
 *
 * Security notes:
 * - Nonces are NEVER reused - each file gets unique nonces
 * - Symmetric keys are random, never derived from passwords
 * - Content hash is computed BEFORE encryption for integrity verification
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

/**
 * Result of file encryption operation
 */
export interface EncryptedFileResult {
  /** Encrypted file content (XSalsa20-Poly1305) */
  encryptedData: Uint8Array;
  /** Encrypted symmetric key (Box encryption with recipient's public key) */
  encryptedKey: string;
  /** Ephemeral public key used for key encryption (needed for decryption) */
  ephemeralPublicKey: string;
  /** Nonce used for file encryption (unique per file) */
  fileNonce: string;
  /** Nonce used for key encryption */
  keyNonce: string;
  /** SHA-256 hash of original content (computed before encryption) */
  contentHash: string;
  /** Original file size in bytes */
  originalSize: number;
}

/**
 * Parameters for file decryption
 */
export interface DecryptionParams {
  /** Encrypted file content */
  encryptedData: Uint8Array;
  /** Encrypted symmetric key (base64) */
  encryptedKey: string;
  /** Ephemeral public key used during encryption (base64) */
  ephemeralPublicKey: string;
  /** Nonce used for file encryption (base64) */
  fileNonce: string;
  /** Nonce used for key encryption (base64) */
  keyNonce: string;
  /** Recipient's secret key (32 bytes for X25519) */
  recipientSecretKey: Uint8Array;
}

/**
 * Generate a cryptographically secure random nonce for file encryption
 * NEVER reuse nonces - this function generates a fresh one each call
 */
export function generateFileNonce(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.nonceLength);
}

/**
 * Generate a cryptographically secure random nonce for box encryption
 */
export function generateBoxNonce(): Uint8Array {
  return nacl.randomBytes(nacl.box.nonceLength);
}

/**
 * Generate a random symmetric key for file encryption
 */
export function generateSymmetricKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

/**
 * Compute SHA-256 hash of content
 * Returns hex string prefixed with 0x
 */
export async function hashContent(data: Uint8Array): Promise<string> {
  // Ensure we have a proper ArrayBuffer for the Web Crypto API
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt a file for storage on Filecoin
 *
 * @param fileData - Raw file content as Uint8Array
 * @param recipientPublicKey - Recipient's X25519 public key (base64)
 * @returns Encrypted file data and metadata
 */
export async function encryptFile(
  fileData: Uint8Array,
  recipientPublicKey: string
): Promise<EncryptedFileResult> {
  // Validate input
  if (!fileData || fileData.length === 0) {
    throw new EncryptionError('ENCRYPT_EMPTY_FILE', 'Cannot encrypt empty file');
  }

  if (!recipientPublicKey) {
    throw new EncryptionError(
      'ENCRYPT_NO_KEY',
      'Recipient public key is required'
    );
  }

  // Decode and validate recipient's public key BEFORE any crypto operations
  let recipientPubKeyBytes: Uint8Array;
  try {
    recipientPubKeyBytes = decodeBase64(recipientPublicKey);
  } catch {
    throw new EncryptionError(
      'ENCRYPT_INVALID_KEY',
      'Invalid recipient public key format'
    );
  }

  if (recipientPubKeyBytes.length !== nacl.box.publicKeyLength) {
    throw new EncryptionError(
      'ENCRYPT_INVALID_KEY',
      `Invalid recipient public key length: expected ${nacl.box.publicKeyLength}, got ${recipientPubKeyBytes.length}`
    );
  }

  // Ensure fileData is a proper Uint8Array (not a typed array view)
  const fileBytes = new Uint8Array(fileData);

  // Compute content hash BEFORE encryption (for integrity verification)
  const contentHash = await hashContent(fileBytes);
  const originalSize = fileBytes.length;

  // Generate random symmetric key for this file
  const symmetricKey = generateSymmetricKey();

  // Generate unique nonce for file encryption - NEVER REUSED
  const fileNonce = generateFileNonce();

  // Encrypt file content with symmetric key (XSalsa20-Poly1305)
  const encryptedData = nacl.secretbox(fileBytes, fileNonce, symmetricKey);

  // Generate ephemeral keypair for key encryption
  // This provides forward secrecy - even if recipient's key is later compromised,
  // past encrypted keys cannot be recovered without the ephemeral secret key
  const ephemeralKeyPair = nacl.box.keyPair();

  // Generate unique nonce for key encryption
  const keyNonce = generateBoxNonce();

  // Encrypt symmetric key with recipient's public key (X25519 + XSalsa20-Poly1305)
  const encryptedKey = nacl.box(
    symmetricKey,
    keyNonce,
    recipientPubKeyBytes,
    ephemeralKeyPair.secretKey
  );

  // Clear sensitive data from memory
  symmetricKey.fill(0);
  ephemeralKeyPair.secretKey.fill(0);

  return {
    encryptedData,
    encryptedKey: encodeBase64(encryptedKey),
    ephemeralPublicKey: encodeBase64(ephemeralKeyPair.publicKey),
    fileNonce: encodeBase64(fileNonce),
    keyNonce: encodeBase64(keyNonce),
    contentHash,
    originalSize,
  };
}

/**
 * Decrypt a file retrieved from Filecoin
 *
 * @param params - Decryption parameters
 * @returns Decrypted file content
 */
export function decryptFile(params: DecryptionParams): Uint8Array {
  const {
    encryptedData,
    encryptedKey,
    ephemeralPublicKey,
    fileNonce,
    keyNonce,
    recipientSecretKey,
  } = params;

  // Validate inputs
  if (!encryptedData || encryptedData.length === 0) {
    throw new DecryptionError(
      'DECRYPT_EMPTY_DATA',
      'No encrypted data provided'
    );
  }

  if (recipientSecretKey.length !== nacl.box.secretKeyLength) {
    throw new DecryptionError(
      'DECRYPT_INVALID_KEY',
      `Invalid secret key length: expected ${nacl.box.secretKeyLength}, got ${recipientSecretKey.length}`
    );
  }

  // Decode base64 values
  let encryptedKeyBytes: Uint8Array;
  let ephemeralPubKeyBytes: Uint8Array;
  let fileNonceBytes: Uint8Array;
  let keyNonceBytes: Uint8Array;

  try {
    encryptedKeyBytes = decodeBase64(encryptedKey);
    ephemeralPubKeyBytes = decodeBase64(ephemeralPublicKey);
    fileNonceBytes = decodeBase64(fileNonce);
    keyNonceBytes = decodeBase64(keyNonce);
  } catch {
    throw new DecryptionError(
      'DECRYPT_INVALID_FORMAT',
      'Invalid encryption metadata format'
    );
  }

  // Validate nonce lengths
  if (fileNonceBytes.length !== nacl.secretbox.nonceLength) {
    throw new DecryptionError(
      'DECRYPT_INVALID_NONCE',
      'Invalid file nonce length'
    );
  }

  if (keyNonceBytes.length !== nacl.box.nonceLength) {
    throw new DecryptionError(
      'DECRYPT_INVALID_NONCE',
      'Invalid key nonce length'
    );
  }

  // Decrypt the symmetric key using recipient's secret key
  const symmetricKey = nacl.box.open(
    encryptedKeyBytes,
    keyNonceBytes,
    ephemeralPubKeyBytes,
    recipientSecretKey
  );

  if (!symmetricKey) {
    throw new DecryptionError(
      'DECRYPT_KEY_FAILED',
      'Failed to decrypt file key. Access denied or data corrupted.'
    );
  }

  // Decrypt the file content using the symmetric key
  const decryptedData = nacl.secretbox.open(
    encryptedData,
    fileNonceBytes,
    symmetricKey
  );

  // Clear symmetric key from memory
  symmetricKey.fill(0);

  if (!decryptedData) {
    throw new DecryptionError(
      'DECRYPT_FILE_FAILED',
      'Failed to decrypt file. Data may be corrupted.'
    );
  }

  return decryptedData;
}

/**
 * Verify content hash matches decrypted data
 * Used to verify file integrity after decryption
 */
export async function verifyContentHash(
  decryptedData: Uint8Array,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await hashContent(decryptedData);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Read a File object as Uint8Array
 */
export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Encrypt a File object for upload
 * Convenience wrapper around encryptFile
 */
export async function encryptFileForUpload(
  file: File,
  recipientPublicKey: string
): Promise<EncryptedFileResult & { mimeType: string; fileName: string }> {
  const fileData = await readFileAsBytes(file);
  const encryptedResult = await encryptFile(fileData, recipientPublicKey);

  return {
    ...encryptedResult,
    mimeType: file.type,
    fileName: file.name,
  };
}

/**
 * Create a downloadable Blob from decrypted data
 */
export function createDownloadBlob(
  decryptedData: Uint8Array,
  mimeType: string
): Blob {
  // Create a copy as a regular ArrayBuffer to avoid SharedArrayBuffer issues
  const buffer = decryptedData.buffer.slice(
    decryptedData.byteOffset,
    decryptedData.byteOffset + decryptedData.byteLength
  ) as ArrayBuffer;
  return new Blob([buffer], { type: mimeType });
}

/**
 * Trigger file download in browser
 */
export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Encryption error class
 */
export class EncryptionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Decryption error class
 */
export class DecryptionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Encryption error codes for user-friendly messages
 */
export const ENCRYPTION_ERROR_CODES = {
  ENCRYPT_EMPTY_FILE: 'Cannot encrypt an empty file',
  ENCRYPT_NO_KEY: 'Encryption key not available',
  ENCRYPT_INVALID_KEY: 'Invalid encryption key format',
  DECRYPT_EMPTY_DATA: 'No encrypted data provided',
  DECRYPT_INVALID_KEY: 'Invalid decryption key',
  DECRYPT_INVALID_FORMAT: 'Encrypted data format is invalid',
  DECRYPT_INVALID_NONCE: 'Invalid encryption nonce',
  DECRYPT_KEY_FAILED: 'Unable to decrypt. You may not have access to this file.',
  DECRYPT_FILE_FAILED: 'File decryption failed. Data may be corrupted.',
} as const;

