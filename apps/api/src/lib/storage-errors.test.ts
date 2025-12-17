/**
 * Storage Error Handling Unit Tests
 */
import { describe, it, expect } from 'vitest';

import {
  StorageError,
  StorageErrorCode,
  translateStorageError,
  createEmptyFileError,
  createFileTooLargeError,
  createInvalidCidError,
  createMissingCidError,
  isStorageError,
} from './storage-errors.js';

describe('StorageError', () => {
  it('should create error with all properties', () => {
    const error = new StorageError(
      StorageErrorCode.UPLOAD_FAILED,
      'User message',
      'Technical message',
      { key: 'value' }
    );

    expect(error.code).toBe(StorageErrorCode.UPLOAD_FAILED);
    expect(error.userMessage).toBe('User message');
    expect(error.message).toBe('Technical message');
    expect(error.details).toEqual({ key: 'value' });
    expect(error.name).toBe('StorageError');
  });

  it('should serialize to JSON correctly', () => {
    const error = new StorageError(
      StorageErrorCode.INSUFFICIENT_FUNDS,
      'Not enough FIL',
      'Balance: 0'
    );

    const json = error.toJSON();

    expect(json.error).toBe(StorageErrorCode.INSUFFICIENT_FUNDS);
    expect(json.code).toBe(StorageErrorCode.INSUFFICIENT_FUNDS);
    expect(json.message).toBe('Not enough FIL');
    // Technical details should NOT be in JSON
    expect(json).not.toHaveProperty('technicalMessage');
    expect(json).not.toHaveProperty('details');
  });
});

describe('translateStorageError', () => {
  it('should return StorageError as-is', () => {
    const original = new StorageError(
      StorageErrorCode.UPLOAD_FAILED,
      'Original',
      'Tech'
    );

    const result = translateStorageError(original);

    expect(result).toBe(original);
  });

  it('should translate insufficient funds errors', () => {
    const error = new Error('insufficient balance for transaction');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.INSUFFICIENT_FUNDS);
    expect(result.userMessage).toContain('Insufficient funds');
  });

  it('should translate timeout errors', () => {
    const error = new Error('request timed out');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.UPLOAD_TIMEOUT);
    expect(result.userMessage).toContain('timed out');
  });

  it('should translate network errors', () => {
    const error = new Error('ECONNREFUSED');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.NETWORK_ERROR);
    expect(result.userMessage).toContain('Network error');
  });

  it('should translate not found errors', () => {
    const error = new Error('resource not found');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.NOT_FOUND);
  });

  it('should translate provider unavailable errors', () => {
    const error = new Error('provider unavailable 503');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.PROVIDER_UNAVAILABLE);
  });

  it('should translate deal errors', () => {
    const error = new Error('deal failed');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.DEAL_FAILED);
  });

  it('should translate CID errors with "invalid cid"', () => {
    const error = new Error('invalid cid format');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.INVALID_CID);
  });

  it('should translate CID errors with "pieceCid"', () => {
    const error = new Error('Missing pieceCid in response');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.INVALID_CID);
  });

  it('should NOT misclassify generic "invalid" errors as CID errors', () => {
    // Errors that just contain "invalid" without CID context
    // should NOT be classified as INVALID_CID
    const error = new Error('Invalid upload session');
    const result = translateStorageError(error);

    // Should be UPLOAD_FAILED (contains "upload" and "fail"-ish context) or UNKNOWN
    expect(result.code).not.toBe(StorageErrorCode.INVALID_CID);
  });

  it('should translate upload failed errors', () => {
    const error = new Error('Failed to upload piece');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.UPLOAD_FAILED);
  });

  it('should handle unknown errors', () => {
    const error = new Error('some random error');
    const result = translateStorageError(error);

    expect(result.code).toBe(StorageErrorCode.UNKNOWN);
    expect(result.userMessage).toContain('unexpected');
  });

  it('should handle non-Error objects', () => {
    const result = translateStorageError('string error');

    expect(result.code).toBe(StorageErrorCode.UNKNOWN);
  });

  it('should handle null/undefined', () => {
    expect(translateStorageError(null).code).toBe(StorageErrorCode.UNKNOWN);
    expect(translateStorageError(undefined).code).toBe(StorageErrorCode.UNKNOWN);
  });
});

describe('Error factory functions', () => {
  describe('createEmptyFileError', () => {
    it('should create correct error', () => {
      const error = createEmptyFileError();

      expect(error.code).toBe(StorageErrorCode.EMPTY_FILE);
      expect(error.userMessage).toContain('empty');
    });
  });

  describe('createFileTooLargeError', () => {
    it('should create error with size details', () => {
      const error = createFileTooLargeError(300 * 1024 * 1024, 200 * 1024 * 1024);

      expect(error.code).toBe(StorageErrorCode.FILE_TOO_LARGE);
      expect(error.details?.actualSize).toBe(300 * 1024 * 1024);
      expect(error.details?.maxSize).toBe(200 * 1024 * 1024);
    });
  });

  describe('createInvalidCidError', () => {
    it('should create error with truncated CID', () => {
      const longCid = 'bagainvalid' + 'x'.repeat(100);
      const error = createInvalidCidError(longCid);

      expect(error.code).toBe(StorageErrorCode.INVALID_CID);
      expect(error.details?.cidPrefix).toHaveLength(20);
    });
  });

  describe('createMissingCidError', () => {
    it('should create error with truncated evidence ID', () => {
      const evidenceId = 'abc12345-6789-0123-4567-890123456789';
      const error = createMissingCidError(evidenceId);

      expect(error.code).toBe(StorageErrorCode.MISSING_CID);
      expect(error.userMessage).toContain('did not return an identifier');
      expect(error.details?.evidenceIdPrefix).toBe('abc12345');
    });

    it('should handle short evidence IDs gracefully', () => {
      const error = createMissingCidError('short');

      expect(error.code).toBe(StorageErrorCode.MISSING_CID);
      // substring(0, 8) on "short" returns "short" (JS is lenient)
      expect(error.details?.evidenceIdPrefix).toBe('short');
    });
  });
});

describe('isStorageError', () => {
  it('should return true for StorageError', () => {
    const error = new StorageError(StorageErrorCode.UNKNOWN, 'test', 'test');
    expect(isStorageError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    expect(isStorageError(new Error('test'))).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isStorageError('string')).toBe(false);
    expect(isStorageError(null)).toBe(false);
    expect(isStorageError({})).toBe(false);
  });
});
