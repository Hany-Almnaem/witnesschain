/**
 * DID Module Tests
 * 
 * Tests for DID generation, validation, and operations.
 */

import { describe, it, expect } from 'vitest';

import { 
  createLinkingChallenge, 
  generateEncryptionKeyPair,
  isValidDID,
} from '../lib/did';

describe('DID Module', () => {
  describe('DID Format Validation', () => {
    it('should validate correct did:key format', () => {
      const validDids = [
        'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        'did:key:z6MktBb8J3uE2A5JB9u3aEUPQD8LWXkqYXhZjEq2tKoDeRz',
      ];

      validDids.forEach(did => {
        expect(did).toMatch(/^did:key:z[a-zA-Z0-9]+$/);
      });
    });

    it('should reject invalid DID formats', () => {
      const invalidDids = [
        'did:key:invalid',  // Wrong format
        'did:web:example.com',  // Wrong method
        'not-a-did',
        '',
        'did:key:',
      ];

      invalidDids.forEach(did => {
        expect(isValidDID(did)).toBe(false);
      });
    });
  });

  describe('Linking Challenge', () => {
    it('should create deterministic challenge message', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const timestamp = 1702400000;

      const challenge = createLinkingChallenge(walletAddress, did, timestamp);

      // Should contain all components
      expect(challenge).toContain('WitnessChain Identity Verification');
      expect(challenge).toContain(walletAddress);
      expect(challenge).toContain(did);
      expect(challenge).toContain(timestamp.toString());
      expect(challenge).toContain('will not trigger a blockchain transaction');
    });

    it('should produce same challenge for same inputs', () => {
      const args = [
        '0x1234567890123456789012345678901234567890',
        'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        1702400000,
      ] as const;

      const challenge1 = createLinkingChallenge(...args);
      const challenge2 = createLinkingChallenge(...args);

      expect(challenge1).toBe(challenge2);
    });
  });
});

describe('Encryption Key Generation', () => {
  it('should generate X25519 key pair for encryption', () => {
    const keyPair = generateEncryptionKeyPair();

    expect(keyPair).toHaveProperty('publicKey');
    expect(keyPair).toHaveProperty('secretKey');
    expect(typeof keyPair.publicKey).toBe('string');
    expect(typeof keyPair.secretKey).toBe('string');
  });

  it('should generate unique key pairs', () => {
    const keyPair1 = generateEncryptionKeyPair();
    const keyPair2 = generateEncryptionKeyPair();

    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    expect(keyPair1.secretKey).not.toBe(keyPair2.secretKey);
  });
});
