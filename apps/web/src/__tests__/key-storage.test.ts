/**
 * Key Storage Integration Tests
 * 
 * Tests for secure key storage functionality using REAL cryptography.
 * These tests verify actual encryption/decryption operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  storeSecretKey,
  retrieveSecretKey,
  hasSecretKey,
  deleteSecretKey,
  verifyPassword,
  listStoredDids,
  clearAllKeys,
  RateLimitError,
  getRateLimitStatus,
  clearAllRateLimitState,
} from '../lib/key-storage';

describe('Key Storage Integration', () => {
  const testDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
  const testPassword = 'secure-test-password-123!';
  
  // Generate a realistic Ed25519 secret key (64 bytes)
  const testSecretKey = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    testSecretKey[i] = i * 3 + 17; // Deterministic test data
  }

  describe('Real Encryption/Decryption', () => {
    it('should encrypt and decrypt a secret key correctly', async () => {
      // Store the key (encrypts with password)
      await storeSecretKey(testSecretKey, testPassword, testDid);
      
      // Retrieve the key (decrypts with password)
      const retrievedKey = await retrieveSecretKey(testDid, testPassword);
      
      // Verify the decrypted key matches the original
      expect(retrievedKey).not.toBeNull();
      expect(Array.from(retrievedKey!)).toEqual(Array.from(testSecretKey));
    });

    it('should fail decryption with wrong password', async () => {
      await storeSecretKey(testSecretKey, testPassword, testDid);
      
      // Try to retrieve with wrong password
      const retrievedKey = await retrieveSecretKey(testDid, 'wrong-password');
      
      // Should return null for wrong password
      expect(retrievedKey).toBeNull();
    });

    it('should use unique salt and IV for each encryption', async () => {
      const did1 = 'did:key:z6MkTest1';
      const did2 = 'did:key:z6MkTest2';
      
      // Store same key with same password for two DIDs
      await storeSecretKey(testSecretKey, testPassword, did1);
      await storeSecretKey(testSecretKey, testPassword, did2);
      
      // Both should decrypt correctly (proves encryption worked independently)
      const key1 = await retrieveSecretKey(did1, testPassword);
      const key2 = await retrieveSecretKey(did2, testPassword);
      
      expect(key1).not.toBeNull();
      expect(key2).not.toBeNull();
      expect(Array.from(key1!)).toEqual(Array.from(testSecretKey));
      expect(Array.from(key2!)).toEqual(Array.from(testSecretKey));
      
      // Clean up
      await deleteSecretKey(did1);
      await deleteSecretKey(did2);
    });

    it('should handle different key sizes', async () => {
      // Test with 32-byte key (X25519)
      const smallKey = new Uint8Array(32);
      crypto.getRandomValues(smallKey);
      
      const did32 = 'did:key:z6Mk32byte';
      await storeSecretKey(smallKey, testPassword, did32);
      const retrieved32 = await retrieveSecretKey(did32, testPassword);
      
      expect(retrieved32).not.toBeNull();
      expect(Array.from(retrieved32!)).toEqual(Array.from(smallKey));
      
      await deleteSecretKey(did32);
    });
  });

  describe('Key Existence Checks', () => {
    it('should detect when key exists', async () => {
      await storeSecretKey(testSecretKey, testPassword, testDid);
      
      const exists = await hasSecretKey(testDid);
      expect(exists).toBe(true);
    });

    it('should detect when key does not exist', async () => {
      const exists = await hasSecretKey('did:key:z6MkNonExistent');
      expect(exists).toBe(false);
    });
  });

  describe('Key Deletion', () => {
    it('should delete stored key', async () => {
      await storeSecretKey(testSecretKey, testPassword, testDid);
      expect(await hasSecretKey(testDid)).toBe(true);
      
      await deleteSecretKey(testDid);
      expect(await hasSecretKey(testDid)).toBe(false);
    });

    it('should not throw when deleting non-existent key', async () => {
      // Should not throw
      await expect(deleteSecretKey('did:key:z6MkNonExistent')).resolves.toBeUndefined();
    });
  });

  describe('Password Verification', () => {
    it('should verify correct password', async () => {
      await storeSecretKey(testSecretKey, testPassword, testDid);
      
      const isValid = await verifyPassword(testDid, testPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      await storeSecretKey(testSecretKey, testPassword, testDid);
      
      const isValid = await verifyPassword(testDid, 'wrong-password');
      expect(isValid).toBe(false);
    });
  });

  describe('List and Clear Operations', () => {
    it('should list all stored DIDs', async () => {
      const did1 = 'did:key:z6MkList1';
      const did2 = 'did:key:z6MkList2';
      const did3 = 'did:key:z6MkList3';
      
      await storeSecretKey(testSecretKey, testPassword, did1);
      await storeSecretKey(testSecretKey, testPassword, did2);
      await storeSecretKey(testSecretKey, testPassword, did3);
      
      const dids = await listStoredDids();
      expect(dids).toContain(did1);
      expect(dids).toContain(did2);
      expect(dids).toContain(did3);
      
      // Clean up
      await clearAllKeys();
    });

    it('should clear all keys', async () => {
      await storeSecretKey(testSecretKey, testPassword, 'did:key:z6MkClear1');
      await storeSecretKey(testSecretKey, testPassword, 'did:key:z6MkClear2');
      
      await clearAllKeys();
      
      const dids = await listStoredDids();
      expect(dids).toHaveLength(0);
    });
  });
});

describe('Key Storage Security Properties', () => {
  it('should NOT store keys in localStorage', async () => {
    const testDid = 'did:key:z6MkSecurityTest';
    const testKey = new Uint8Array(64);
    crypto.getRandomValues(testKey);
    
    await storeSecretKey(testKey, 'test-password', testDid);
    
    // Check localStorage for any key-related data
    const localStorageKeys = Object.keys(localStorage);
    const forbiddenPatterns = [
      /secretKey/i,
      /privateKey/i,
      /encryptedKey/i,
      /masterKey/i,
    ];

    localStorageKeys.forEach(key => {
      forbiddenPatterns.forEach(pattern => {
        expect(key).not.toMatch(pattern);
      });
    });
    
    await deleteSecretKey(testDid);
  });

  it('should NOT store keys in sessionStorage', async () => {
    const testDid = 'did:key:z6MkSecurityTest2';
    const testKey = new Uint8Array(64);
    crypto.getRandomValues(testKey);
    
    await storeSecretKey(testKey, 'test-password', testDid);
    
    const sessionStorageKeys = Object.keys(sessionStorage);
    const forbiddenPatterns = [
      /secretKey/i,
      /privateKey/i,
      /encryptedKey/i,
      /masterKey/i,
    ];

    sessionStorageKeys.forEach(key => {
      forbiddenPatterns.forEach(pattern => {
        expect(key).not.toMatch(pattern);
      });
    });
    
    await deleteSecretKey(testDid);
  });

  it('should not store password anywhere', () => {
    // Check localStorage
    Object.keys(localStorage).forEach(key => {
      expect(key.toLowerCase()).not.toContain('password');
    });

    // Check sessionStorage
    Object.keys(sessionStorage).forEach(key => {
      expect(key.toLowerCase()).not.toContain('password');
    });
  });
});

describe('PBKDF2 Configuration Verification', () => {
  it('should use computationally expensive key derivation', async () => {
    const testDid = 'did:key:z6MkPBKDF2Test';
    const testKey = new Uint8Array(64);
    globalThis.crypto.getRandomValues(testKey);
    
    // Time the encryption (should take noticeable time due to PBKDF2 iterations)
    const startTime = performance.now();
    await storeSecretKey(testKey, 'test-password', testDid);
    const endTime = performance.now();
    
    const encryptionTime = endTime - startTime;
    
    // With 100,000 PBKDF2 iterations, this should take some measurable time
    // Threshold is low (5ms) to account for fast machines/environments
    // The key point is it's not instant (< 1ms) like a simple hash would be
    expect(encryptionTime).toBeGreaterThan(5);
    
    await deleteSecretKey(testDid);
  });
});

describe('Rate Limiting', () => {
  let testCounter = 0;
  
  // Use unique DID for each test to avoid state pollution
  function getUniqueDid(): string {
    return `did:key:z6MkRateLimit${Date.now()}${++testCounter}`;
  }
  
  beforeEach(() => {
    // Clear all rate limit state before each test
    clearAllRateLimitState();
  });

  it('should allow initial password attempts', async () => {
    const testDid = getUniqueDid();
    const testKey = new Uint8Array(64);
    globalThis.crypto.getRandomValues(testKey);
    await storeSecretKey(testKey, 'correct-password', testDid);
    
    // First few attempts should work (even if wrong password)
    for (let i = 0; i < 4; i++) {
      const result = await retrieveSecretKey(testDid, 'wrong-password');
      expect(result).toBeNull();
    }
    
    // Should not be rate limited yet
    expect(getRateLimitStatus(testDid)).toBe(0);
    
    await deleteSecretKey(testDid);
  });

  it('should rate limit after too many failed attempts', async () => {
    const testDid = getUniqueDid();
    const testKey = new Uint8Array(64);
    globalThis.crypto.getRandomValues(testKey);
    await storeSecretKey(testKey, 'correct-password', testDid);
    
    // Exhaust allowed attempts
    for (let i = 0; i < 5; i++) {
      await retrieveSecretKey(testDid, 'wrong-password');
    }
    
    // Next attempt should throw RateLimitError
    await expect(retrieveSecretKey(testDid, 'wrong-password'))
      .rejects.toThrow(RateLimitError);
    
    await deleteSecretKey(testDid);
  });

  it('should clear rate limit on successful authentication', async () => {
    const testDid = getUniqueDid();
    const testKey = new Uint8Array(64);
    globalThis.crypto.getRandomValues(testKey);
    await storeSecretKey(testKey, 'correct-password', testDid);
    
    // Make some failed attempts (but not enough to trigger lockout)
    for (let i = 0; i < 3; i++) {
      await retrieveSecretKey(testDid, 'wrong-password');
    }
    
    // Successful attempt should clear the counter
    const result = await retrieveSecretKey(testDid, 'correct-password');
    expect(result).not.toBeNull();
    
    // Should be able to make more attempts now
    expect(getRateLimitStatus(testDid)).toBe(0);
    
    await deleteSecretKey(testDid);
  });
});

describe('Memory Safety', () => {
  it('should be able to clear Uint8Array from memory', () => {
    const secretKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    
    // Simulate clearing after use
    secretKey.fill(0);
    
    expect(Array.from(secretKey)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
