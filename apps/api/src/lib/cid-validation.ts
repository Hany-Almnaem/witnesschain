/**
 * CID Validation Utilities
 *
 * Content Identifiers (CIDs) returned from Synapse SDK are treated as untrusted input.
 * This module validates CID format before persistence or display.
 *
 * Supported CID formats:
 * - CIDv0: Qm... (46 characters, base58btc)
 * - CIDv1: bafy... (typically 59 characters, base32)
 * - PieceCID: baga... (Filecoin piece commitment)
 *
 * Note: We validate format only, not cryptographic correctness.
 */

/**
 * Regex patterns for CID validation
 *
 * CIDv0: Starts with "Qm" followed by base58btc characters (1-9, A-H, J-N, P-Z, a-k, m-z)
 * CIDv1: Starts with "b" followed by base32 characters (a-z, 2-7)
 * PieceCID: Starts with "baga" (Filecoin piece commitment in base32)
 */
const CID_V0_PATTERN = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CID_V1_PATTERN = /^b[a-z2-7]{58,}$/;
const PIECE_CID_PATTERN = /^baga[a-z2-7]{56,}$/;

/**
 * Relaxed pattern for any CID-like string
 * Used for initial filtering before more specific validation
 */
const CID_LOOSE_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/;

/**
 * CID validation result
 */
export interface CidValidationResult {
  isValid: boolean;
  format: 'v0' | 'v1' | 'piece' | 'unknown';
  error?: string;
}

/**
 * Validate a CID string format
 *
 * @param cid - The CID string to validate
 * @returns Validation result with format information
 */
export function validateCid(cid: string): CidValidationResult {
  // Basic checks
  if (!cid || typeof cid !== 'string') {
    return {
      isValid: false,
      format: 'unknown',
      error: 'CID must be a non-empty string',
    };
  }

  const trimmed = cid.trim();

  // Length check
  if (trimmed.length < 46) {
    return {
      isValid: false,
      format: 'unknown',
      error: 'CID is too short',
    };
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      format: 'unknown',
      error: 'CID is too long',
    };
  }

  // Check for CIDv0 (Qm...)
  if (trimmed.startsWith('Qm')) {
    if (CID_V0_PATTERN.test(trimmed)) {
      return { isValid: true, format: 'v0' };
    }
    return {
      isValid: false,
      format: 'v0',
      error: 'Invalid CIDv0 format',
    };
  }

  // Check for PieceCID (baga...)
  if (trimmed.startsWith('baga')) {
    if (PIECE_CID_PATTERN.test(trimmed)) {
      return { isValid: true, format: 'piece' };
    }
    return {
      isValid: false,
      format: 'piece',
      error: 'Invalid PieceCID format',
    };
  }

  // Check for CIDv1 (b...)
  if (trimmed.startsWith('b')) {
    if (CID_V1_PATTERN.test(trimmed)) {
      return { isValid: true, format: 'v1' };
    }
    return {
      isValid: false,
      format: 'v1',
      error: 'Invalid CIDv1 format',
    };
  }

  return {
    isValid: false,
    format: 'unknown',
    error: 'Unrecognized CID format',
  };
}

/**
 * Check if a string is a valid CID
 *
 * @param cid - The CID string to check
 * @returns True if valid, false otherwise
 */
export function isValidCid(cid: string): boolean {
  return validateCid(cid).isValid;
}

/**
 * Check if a string looks like a PieceCID (Filecoin specific)
 *
 * PieceCIDs are used for Filecoin storage deals and typically start with "baga"
 */
export function isPieceCid(cid: string): boolean {
  if (!cid || typeof cid !== 'string') {
    return false;
  }
  return PIECE_CID_PATTERN.test(cid.trim());
}

/**
 * Sanitize a CID for safe logging
 * Truncates long CIDs to prevent log flooding
 */
export function sanitizeCidForLog(cid: string): string {
  if (!cid || typeof cid !== 'string') {
    return '[invalid]';
  }

  const trimmed = cid.trim();
  if (trimmed.length <= 20) {
    return trimmed;
  }

  return `${trimmed.substring(0, 10)}...${trimmed.substring(trimmed.length - 10)}`;
}

/**
 * Assert that a CID is valid, throwing if not
 *
 * @param cid - The CID to validate
 * @throws {Error} If CID is invalid
 */
export function assertValidCid(cid: string): void {
  const result = validateCid(cid);
  if (!result.isValid) {
    throw new Error(`Invalid CID: ${result.error}`);
  }
}

/**
 * Validate a CID and return it if valid, or throw
 * Useful for pipeline validation
 */
export function requireValidCid(cid: string): string {
  assertValidCid(cid);
  return cid.trim();
}
