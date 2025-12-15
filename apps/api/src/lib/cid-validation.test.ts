/**
 * CID Validation Unit Tests
 */
import { describe, it, expect } from 'vitest';

import {
  validateCid,
  isValidCid,
  isPieceCid,
  sanitizeCidForLog,
  assertValidCid,
  requireValidCid,
} from './cid-validation.js';

describe('CID Validation', () => {
  describe('validateCid', () => {
    it('should validate CIDv0 (Qm...)', () => {
      const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
      const result = validateCid(cid);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('v0');
      expect(result.error).toBeUndefined();
    });

    it('should validate CIDv1 (bafy...)', () => {
      const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      const result = validateCid(cid);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('v1');
      expect(result.error).toBeUndefined();
    });

    it('should validate PieceCID (baga...)', () => {
      const cid = 'baga6ea4seaqjtovkwk4myyzj56eztkh5pzsk5upksan6f5outesy62bsvl4dsha';
      const result = validateCid(cid);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('piece');
      expect(result.error).toBeUndefined();
    });

    it('should reject empty string', () => {
      const result = validateCid('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('CID must be a non-empty string');
    });

    it('should reject null/undefined', () => {
      expect(validateCid(null as unknown as string).isValid).toBe(false);
      expect(validateCid(undefined as unknown as string).isValid).toBe(false);
    });

    it('should reject too short CID', () => {
      const result = validateCid('Qm12345');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('CID is too short');
    });

    it('should reject too long CID', () => {
      const result = validateCid('b' + 'a'.repeat(200));

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('CID is too long');
    });

    it('should reject invalid CIDv0 format with correct length', () => {
      // 46 characters starting with Qm but with invalid base58btc chars (0, O, I, l are not valid)
      const result = validateCid('Qm00000000000000000000000000000000000000000000');

      expect(result.isValid).toBe(false);
      // The string starts with Qm and is 46 chars, so recognized as v0 attempt
      expect(result.format).toBe('v0');
      expect(result.error).toBe('Invalid CIDv0 format');
    });

    it('should reject too short CIDv0-like string', () => {
      // Starts with Qm but too short - fails length check first
      const result = validateCid('QmInvalidCharacters!!!!!!!!');

      expect(result.isValid).toBe(false);
      // Fails length check before format detection
      expect(result.format).toBe('unknown');
      expect(result.error).toBe('CID is too short');
    });

    it('should reject unrecognized format', () => {
      const result = validateCid('zQmTest1234567890123456789012345678901234567890');

      expect(result.isValid).toBe(false);
      expect(result.format).toBe('unknown');
      expect(result.error).toBe('Unrecognized CID format');
    });

    it('should handle whitespace', () => {
      const cid = '  QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG  ';
      const result = validateCid(cid);

      expect(result.isValid).toBe(true);
    });
  });

  describe('isValidCid', () => {
    it('should return true for valid CID', () => {
      expect(isValidCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(true);
    });

    it('should return false for invalid CID', () => {
      expect(isValidCid('invalid')).toBe(false);
      expect(isValidCid('')).toBe(false);
    });
  });

  describe('isPieceCid', () => {
    it('should return true for PieceCID', () => {
      expect(isPieceCid('baga6ea4seaqjtovkwk4myyzj56eztkh5pzsk5upksan6f5outesy62bsvl4dsha')).toBe(true);
    });

    it('should return false for non-PieceCID', () => {
      expect(isPieceCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(false);
      expect(isPieceCid('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(false);
    });

    it('should return false for invalid input', () => {
      expect(isPieceCid('')).toBe(false);
      expect(isPieceCid(null as unknown as string)).toBe(false);
    });
  });

  describe('sanitizeCidForLog', () => {
    it('should truncate long CIDs', () => {
      const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
      const sanitized = sanitizeCidForLog(cid);

      expect(sanitized).toBe('QmYwAPJzv5...79ojWnPbdG');
      expect(sanitized.length).toBeLessThan(cid.length);
    });

    it('should not truncate short strings', () => {
      expect(sanitizeCidForLog('short')).toBe('short');
    });

    it('should handle invalid input', () => {
      expect(sanitizeCidForLog('')).toBe('[invalid]');
      expect(sanitizeCidForLog(null as unknown as string)).toBe('[invalid]');
    });
  });

  describe('assertValidCid', () => {
    it('should not throw for valid CID', () => {
      expect(() => {
        assertValidCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
      }).not.toThrow();
    });

    it('should throw for invalid CID', () => {
      expect(() => {
        assertValidCid('invalid');
      }).toThrow('Invalid CID');
    });
  });

  describe('requireValidCid', () => {
    it('should return trimmed CID for valid input', () => {
      const result = requireValidCid('  QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG  ');
      expect(result).toBe('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
    });

    it('should throw for invalid CID', () => {
      expect(() => requireValidCid('invalid')).toThrow();
    });
  });
});
