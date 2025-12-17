/**
 * DID Module Integration Tests
 * 
 * Tests for DID generation, validation, signing, and verification
 * using REAL cryptographic operations.
 */

import { describe, it, expect } from 'vitest';

import { 
  generateDIDKeyPair,
  restoreDIDFromSecretKey,
  signWithDID,
  verifyDIDSignature,
  didToPublicKey,
  isValidDID,
  didToIdentifier,
  generateEncryptionKeyPair,
  deriveEncryptionKeyPair,
  getEncryptionPublicKey,
  getEncryptionSecretKey,
} from '../lib/did';
import { createLinkingChallenge } from '@witnesschain/shared';

describe('DID Generation', () => {
  it('should generate valid DID keypair', async () => {
    const keyPair = await generateDIDKeyPair();
    
    expect(keyPair.did).toMatch(/^did:key:z[a-zA-Z0-9]+$/);
    expect(keyPair.publicKey).toBeTruthy();
    expect(keyPair.secretKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.secretKey.length).toBe(64); // Ed25519 secret key is 64 bytes
  });

  it('should generate unique DIDs each time', async () => {
    const keyPair1 = await generateDIDKeyPair();
    const keyPair2 = await generateDIDKeyPair();
    
    expect(keyPair1.did).not.toBe(keyPair2.did);
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
  });

  it('should produce DID that passes validation', async () => {
    const keyPair = await generateDIDKeyPair();
    
    expect(isValidDID(keyPair.did)).toBe(true);
  });
});

describe('DID Restoration', () => {
  it('should restore DID from secret key', async () => {
    const original = await generateDIDKeyPair();
    
    const restored = await restoreDIDFromSecretKey(original.secretKey);
    
    expect(restored.did).toBe(original.did);
    expect(restored.publicKey).toBe(original.publicKey);
  });

  it('should produce consistent results', async () => {
    const keyPair = await generateDIDKeyPair();
    
    const restored1 = await restoreDIDFromSecretKey(keyPair.secretKey);
    const restored2 = await restoreDIDFromSecretKey(keyPair.secretKey);
    
    expect(restored1.did).toBe(restored2.did);
    expect(restored1.publicKey).toBe(restored2.publicKey);
  });
});

describe('DID Signing and Verification', () => {
  // Helper to ensure proper Uint8Array (TextEncoder might return subclass)
  function toUint8Array(str: string): Uint8Array {
    const encoded = new TextEncoder().encode(str);
    return new Uint8Array(encoded);
  }

  it('should sign and verify data correctly', async () => {
    const keyPair = await generateDIDKeyPair();
    const message = toUint8Array('Test message for signing');
    
    const signature = await signWithDID(keyPair.secretKey, message);
    
    expect(signature).toBeTruthy();
    expect(typeof signature).toBe('string');
    
    // Verify the signature
    const isValid = await verifyDIDSignature(keyPair.did, signature, message);
    expect(isValid).toBe(true);
  });

  it('should reject invalid signatures', async () => {
    const keyPair = await generateDIDKeyPair();
    const message = toUint8Array('Original message');
    
    const signature = await signWithDID(keyPair.secretKey, message);
    
    // Try to verify with different message
    const differentMessage = toUint8Array('Different message');
    const isValid = await verifyDIDSignature(keyPair.did, signature, differentMessage);
    
    expect(isValid).toBe(false);
  });

  it('should reject signature from different DID', async () => {
    const keyPair1 = await generateDIDKeyPair();
    const keyPair2 = await generateDIDKeyPair();
    const message = toUint8Array('Test message');
    
    // Sign with keyPair1
    const signature = await signWithDID(keyPair1.secretKey, message);
    
    // Try to verify with keyPair2's DID
    const isValid = await verifyDIDSignature(keyPair2.did, signature, message);
    
    expect(isValid).toBe(false);
  });

  it('should handle empty message', async () => {
    const keyPair = await generateDIDKeyPair();
    const emptyMessage = new Uint8Array(0);
    
    const signature = await signWithDID(keyPair.secretKey, emptyMessage);
    const isValid = await verifyDIDSignature(keyPair.did, signature, emptyMessage);
    
    expect(isValid).toBe(true);
  });

  it('should handle large message', async () => {
    const keyPair = await generateDIDKeyPair();
    const largeMessage = new Uint8Array(10000);
    globalThis.crypto.getRandomValues(largeMessage);
    
    const signature = await signWithDID(keyPair.secretKey, largeMessage);
    const isValid = await verifyDIDSignature(keyPair.did, signature, largeMessage);
    
    expect(isValid).toBe(true);
  });
});

describe('DID Validation', () => {
    it('should validate correct did:key format', () => {
      const validDids = [
        'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        'did:key:z6MktBb8J3uE2A5JB9u3aEUPQD8LWXkqYXhZjEq2tKoDeRz',
      ];

      validDids.forEach(did => {
      expect(isValidDID(did)).toBe(true);
      });
    });

    it('should reject invalid DID formats', () => {
      const invalidDids = [
      'did:key:invalid',
      'did:web:example.com',
        'not-a-did',
        '',
        'did:key:',
      'did:key:z', // Too short
      null as unknown as string,
      undefined as unknown as string,
      ];

      invalidDids.forEach(did => {
        expect(isValidDID(did)).toBe(false);
      });
    });

  it('should validate generated DIDs', async () => {
    // Generate several DIDs and validate them all
    for (let i = 0; i < 5; i++) {
      const keyPair = await generateDIDKeyPair();
      expect(isValidDID(keyPair.did)).toBe(true);
    }
  });
});

describe('DID to Public Key Extraction', () => {
  it('should extract public key from DID', async () => {
    const keyPair = await generateDIDKeyPair();
    
    const extractedPublicKey = didToPublicKey(keyPair.did);
    
    expect(extractedPublicKey).toBe(keyPair.publicKey);
  });

  it('should throw for invalid DID format', () => {
    expect(() => didToPublicKey('invalid-did')).toThrow();
    expect(() => didToPublicKey('did:web:example.com')).toThrow();
  });
});

describe('DID to Identifier', () => {
  it('should generate deterministic identifier from DID', async () => {
    const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
    
    const id1 = await didToIdentifier(did);
    const id2 = await didToIdentifier(did);
    
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('should generate different identifiers for different DIDs', async () => {
    const did1 = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
    const did2 = 'did:key:z6MktBb8J3uE2A5JB9u3aEUPQD8LWXkqYXhZjEq2tKoDeRz';
    
    const id1 = await didToIdentifier(did1);
    const id2 = await didToIdentifier(did2);
    
    expect(id1).not.toBe(id2);
  });
  });

  describe('Linking Challenge', () => {
    it('should create deterministic challenge message', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const timestamp = 1702400000;

      const challenge = createLinkingChallenge(walletAddress, did, timestamp);

      expect(challenge).toContain('WitnessChain Identity Verification');
    expect(challenge).toContain(walletAddress.toLowerCase()); // Should be normalized
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

  it('should normalize wallet address to lowercase', () => {
    const upperWallet = '0xABCDEF1234567890123456789012345678901234';
    const lowerWallet = '0xabcdef1234567890123456789012345678901234';
    const did = 'did:key:z6MkTest';
    const timestamp = 1702400000;

    const challenge1 = createLinkingChallenge(upperWallet, did, timestamp);
    const challenge2 = createLinkingChallenge(lowerWallet, did, timestamp);

    expect(challenge1).toBe(challenge2);
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

describe('X25519 Key Derivation from Ed25519', () => {
  it('should derive X25519 keypair from Ed25519 secret key', async () => {
    const didKeyPair = await generateDIDKeyPair();
    
    // Derive X25519 keypair from the Ed25519 secret key
    const x25519KeyPair = deriveEncryptionKeyPair(didKeyPair.secretKey);
    
    // X25519 keys should be exactly 32 bytes
    expect(x25519KeyPair.publicKey).toBeInstanceOf(Uint8Array);
    expect(x25519KeyPair.publicKey.length).toBe(32);
    expect(x25519KeyPair.secretKey).toBeInstanceOf(Uint8Array);
    expect(x25519KeyPair.secretKey.length).toBe(32);
  });

  it('should produce deterministic X25519 keys from same Ed25519 key', async () => {
    const didKeyPair = await generateDIDKeyPair();
    
    // Derive twice from the same Ed25519 key
    const x25519KeyPair1 = deriveEncryptionKeyPair(didKeyPair.secretKey);
    const x25519KeyPair2 = deriveEncryptionKeyPair(didKeyPair.secretKey);
    
    // Should be identical
    expect(x25519KeyPair1.publicKey).toEqual(x25519KeyPair2.publicKey);
    expect(x25519KeyPair1.secretKey).toEqual(x25519KeyPair2.secretKey);
  });

  it('should produce different X25519 keys from different Ed25519 keys', async () => {
    const didKeyPair1 = await generateDIDKeyPair();
    const didKeyPair2 = await generateDIDKeyPair();
    
    const x25519KeyPair1 = deriveEncryptionKeyPair(didKeyPair1.secretKey);
    const x25519KeyPair2 = deriveEncryptionKeyPair(didKeyPair2.secretKey);
    
    // Should be different
    expect(x25519KeyPair1.publicKey).not.toEqual(x25519KeyPair2.publicKey);
    expect(x25519KeyPair1.secretKey).not.toEqual(x25519KeyPair2.secretKey);
  });

  it('should reject Ed25519 key with invalid length', () => {
    // Too short
    expect(() => deriveEncryptionKeyPair(new Uint8Array(32))).toThrow(
      'Invalid Ed25519 secret key length: expected 64, got 32'
    );
    
    // Too long
    expect(() => deriveEncryptionKeyPair(new Uint8Array(128))).toThrow(
      'Invalid Ed25519 secret key length: expected 64, got 128'
    );
    
    // Empty
    expect(() => deriveEncryptionKeyPair(new Uint8Array(0))).toThrow(
      'Invalid Ed25519 secret key length: expected 64, got 0'
    );
  });

  it('should return base64 public key via getEncryptionPublicKey', async () => {
    const didKeyPair = await generateDIDKeyPair();
    
    const publicKeyBase64 = getEncryptionPublicKey(didKeyPair.secretKey);
    
    expect(typeof publicKeyBase64).toBe('string');
    // Base64 of 32 bytes should be approximately 44 characters
    expect(publicKeyBase64.length).toBeGreaterThan(30);
    expect(publicKeyBase64.length).toBeLessThan(50);
  });

  it('should return 32-byte secret key via getEncryptionSecretKey', async () => {
    const didKeyPair = await generateDIDKeyPair();
    
    const secretKey = getEncryptionSecretKey(didKeyPair.secretKey);
    
    expect(secretKey).toBeInstanceOf(Uint8Array);
    expect(secretKey.length).toBe(32);
  });
});

describe('X25519 Keys Work with nacl.box', () => {
  it('should encrypt and decrypt using derived X25519 keys', async () => {
    // Import nacl for this test
    const nacl = await import('tweetnacl');
    
    // Generate DID keypair (Ed25519)
    const didKeyPair = await generateDIDKeyPair();
    
    // Derive X25519 keypair from Ed25519 secret key
    const x25519KeyPair = deriveEncryptionKeyPair(didKeyPair.secretKey);
    
    // Generate ephemeral keypair for sender
    const ephemeralKeyPair = nacl.box.keyPair();
    
    // Message to encrypt - ensure it's a proper Uint8Array
    const messageText = 'Hello, X25519!';
    const message = new Uint8Array(new TextEncoder().encode(messageText));
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    
    // Encrypt with recipient's X25519 public key
    const encrypted = nacl.box(
      message,
      nonce,
      x25519KeyPair.publicKey,
      ephemeralKeyPair.secretKey
    );
    
    expect(encrypted).toBeInstanceOf(Uint8Array);
    expect(encrypted.length).toBeGreaterThan(0);
    
    // Decrypt with recipient's X25519 secret key
    const decrypted = nacl.box.open(
      encrypted,
      nonce,
      ephemeralKeyPair.publicKey,
      x25519KeyPair.secretKey
    );
    
    expect(decrypted).not.toBeNull();
    expect(new TextDecoder().decode(decrypted!)).toBe(messageText);
  });
});

describe('Full DID Lifecycle', () => {
  it('should support complete generate -> store -> restore -> sign cycle', async () => {
    // 1. Generate new DID
    const keyPair = await generateDIDKeyPair();
    expect(isValidDID(keyPair.did)).toBe(true);
    
    // 2. Simulate storage by copying secret key
    const storedSecretKey = new Uint8Array(keyPair.secretKey);
    
    // 3. Clear original (as would happen in real code)
    keyPair.secretKey.fill(0);
    
    // 4. Restore from stored secret key
    const restored = await restoreDIDFromSecretKey(storedSecretKey);
    expect(restored.did).toBe(keyPair.did);
    
    // 5. Sign a message with restored key (ensure proper Uint8Array)
    const message = new Uint8Array(new TextEncoder().encode('Test lifecycle message'));
    const signature = await signWithDID(storedSecretKey, message);
    
    // 6. Verify signature
    const isValid = await verifyDIDSignature(restored.did, signature, message);
    expect(isValid).toBe(true);
    
    // 7. Clean up
    storedSecretKey.fill(0);
  });
});
