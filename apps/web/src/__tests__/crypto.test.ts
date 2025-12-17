/**
 * Crypto Module Tests
 *
 * Tests file encryption and decryption functionality.
 * Uses real crypto operations - no mocking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

import {
  encryptFile,
  decryptFile,
  hashContent,
  verifyContentHash,
  generateFileNonce,
  generateBoxNonce,
  generateSymmetricKey,
  EncryptionError,
  DecryptionError,
} from '@/lib/crypto';

describe('Crypto Module', () => {
  // Generate a test keypair for each test
  let recipientKeyPair: nacl.BoxKeyPair;
  let recipientPublicKeyBase64: string;

  beforeEach(() => {
    recipientKeyPair = nacl.box.keyPair();
    recipientPublicKeyBase64 = encodeBase64(recipientKeyPair.publicKey);
  });

  describe('hashContent', () => {
    it('should compute consistent SHA-256 hash', async () => {
      const data = new TextEncoder().encode('Hello, WitnessChain!');
      const hash1 = await hashContent(data);
      const hash2 = await hashContent(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different content', async () => {
      const data1 = new TextEncoder().encode('Content A');
      const data2 = new TextEncoder().encode('Content B');

      const hash1 = await hashContent(data1);
      const hash2 = await hashContent(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty data', async () => {
      const data = new Uint8Array(0);
      const hash = await hashContent(data);

      // SHA-256 of empty input is well-known
      expect(hash).toBe(
        '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    });
  });

  describe('nonce generation', () => {
    it('should generate file nonces of correct length', () => {
      const nonce = generateFileNonce();
      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(nonce.length).toBe(nacl.secretbox.nonceLength); // 24 bytes
    });

    it('should generate box nonces of correct length', () => {
      const nonce = generateBoxNonce();
      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(nonce.length).toBe(nacl.box.nonceLength); // 24 bytes
    });

    it('should generate unique nonces each time', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const nonce = generateFileNonce();
        nonces.add(encodeBase64(nonce));
      }
      // All 100 nonces should be unique
      expect(nonces.size).toBe(100);
    });
  });

  describe('symmetric key generation', () => {
    it('should generate keys of correct length', () => {
      const key = generateSymmetricKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(nacl.secretbox.keyLength); // 32 bytes
    });

    it('should generate unique keys each time', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const key = generateSymmetricKey();
        keys.add(encodeBase64(key));
      }
      expect(keys.size).toBe(100);
    });
  });

  describe('encryptFile', () => {
    it('should encrypt file content successfully', async () => {
      const originalContent = new TextEncoder().encode(
        'Test evidence content for encryption'
      );

      const result = await encryptFile(originalContent, recipientPublicKeyBase64);

      expect(result.encryptedData).toBeInstanceOf(Uint8Array);
      expect(result.encryptedData.length).toBeGreaterThan(originalContent.length);
      expect(result.encryptedKey).toBeDefined();
      expect(result.ephemeralPublicKey).toBeDefined();
      expect(result.fileNonce).toBeDefined();
      expect(result.keyNonce).toBeDefined();
      expect(result.contentHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.originalSize).toBe(originalContent.length);
    });

    it('should produce different encrypted output for same content', async () => {
      const originalContent = new TextEncoder().encode('Same content');

      const result1 = await encryptFile(originalContent, recipientPublicKeyBase64);
      const result2 = await encryptFile(originalContent, recipientPublicKeyBase64);

      // Encrypted data should differ due to random nonces
      expect(encodeBase64(result1.encryptedData)).not.toBe(
        encodeBase64(result2.encryptedData)
      );
      // File nonces should be unique
      expect(result1.fileNonce).not.toBe(result2.fileNonce);
      // Key nonces should be unique
      expect(result1.keyNonce).not.toBe(result2.keyNonce);
      // Ephemeral keys should be unique
      expect(result1.ephemeralPublicKey).not.toBe(result2.ephemeralPublicKey);
      // Content hash should be the same (same original content)
      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it('should throw on empty file', async () => {
      const emptyContent = new Uint8Array(0);

      await expect(
        encryptFile(emptyContent, recipientPublicKeyBase64)
      ).rejects.toThrow(EncryptionError);

      await expect(
        encryptFile(emptyContent, recipientPublicKeyBase64)
      ).rejects.toMatchObject({ code: 'ENCRYPT_EMPTY_FILE' });
    });

    it('should throw on missing public key', async () => {
      const content = new TextEncoder().encode('Test');

      await expect(encryptFile(content, '')).rejects.toThrow(EncryptionError);
      await expect(encryptFile(content, '')).rejects.toMatchObject({
        code: 'ENCRYPT_NO_KEY',
      });
    });

    it('should throw on invalid public key format', async () => {
      const content = new TextEncoder().encode('Test');

      await expect(encryptFile(content, 'not-valid-base64!!!')).rejects.toThrow(
        EncryptionError
      );
    });

    it('should throw on wrong public key length', async () => {
      const content = new TextEncoder().encode('Test');
      const shortKey = encodeBase64(new Uint8Array(16)); // Too short

      await expect(encryptFile(content, shortKey)).rejects.toThrow(
        EncryptionError
      );
      await expect(encryptFile(content, shortKey)).rejects.toMatchObject({
        code: 'ENCRYPT_INVALID_KEY',
      });
    });

    it('should handle large files', async () => {
      // 1MB of random data
      const largeContent = nacl.randomBytes(1024 * 1024);

      const result = await encryptFile(largeContent, recipientPublicKeyBase64);

      expect(result.encryptedData.length).toBeGreaterThan(largeContent.length);
      expect(result.originalSize).toBe(1024 * 1024);
    });

    it('should handle binary content', async () => {
      // Binary content with all possible byte values
      const binaryContent = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        binaryContent[i] = i;
      }

      const result = await encryptFile(binaryContent, recipientPublicKeyBase64);

      expect(result.encryptedData).toBeInstanceOf(Uint8Array);
      expect(result.originalSize).toBe(256);
    });
  });

  describe('decryptFile', () => {
    it('should decrypt encrypted content correctly', async () => {
      const originalContent = new TextEncoder().encode(
        'Secret evidence that must be protected'
      );

      const encrypted = await encryptFile(
        originalContent,
        recipientPublicKeyBase64
      );

      const decrypted = decryptFile({
        encryptedData: encrypted.encryptedData,
        encryptedKey: encrypted.encryptedKey,
        ephemeralPublicKey: encrypted.ephemeralPublicKey,
        fileNonce: encrypted.fileNonce,
        keyNonce: encrypted.keyNonce,
        recipientSecretKey: recipientKeyPair.secretKey,
      });

      // Compare array contents (Uint8Array equality)
      expect(Buffer.from(decrypted).toString('hex')).toBe(
        Buffer.from(originalContent).toString('hex')
      );
    });

    it('should verify content hash after decryption', async () => {
      const originalContent = new TextEncoder().encode('Verify this content');

      const encrypted = await encryptFile(
        originalContent,
        recipientPublicKeyBase64
      );

      const decrypted = decryptFile({
        encryptedData: encrypted.encryptedData,
        encryptedKey: encrypted.encryptedKey,
        ephemeralPublicKey: encrypted.ephemeralPublicKey,
        fileNonce: encrypted.fileNonce,
        keyNonce: encrypted.keyNonce,
        recipientSecretKey: recipientKeyPair.secretKey,
      });

      const isValid = await verifyContentHash(decrypted, encrypted.contentHash);
      expect(isValid).toBe(true);
    });

    it('should fail with wrong secret key', async () => {
      const originalContent = new TextEncoder().encode('Secret content');

      const encrypted = await encryptFile(
        originalContent,
        recipientPublicKeyBase64
      );

      const wrongKeyPair = nacl.box.keyPair();

      expect(() =>
        decryptFile({
          encryptedData: encrypted.encryptedData,
          encryptedKey: encrypted.encryptedKey,
          ephemeralPublicKey: encrypted.ephemeralPublicKey,
          fileNonce: encrypted.fileNonce,
          keyNonce: encrypted.keyNonce,
          recipientSecretKey: wrongKeyPair.secretKey,
        })
      ).toThrow(DecryptionError);

      expect(() =>
        decryptFile({
          encryptedData: encrypted.encryptedData,
          encryptedKey: encrypted.encryptedKey,
          ephemeralPublicKey: encrypted.ephemeralPublicKey,
          fileNonce: encrypted.fileNonce,
          keyNonce: encrypted.keyNonce,
          recipientSecretKey: wrongKeyPair.secretKey,
        })
      ).toThrow('Failed to decrypt file key');
    });

    it('should fail with corrupted encrypted data', async () => {
      const originalContent = new TextEncoder().encode('Corrupt this');

      const encrypted = await encryptFile(
        originalContent,
        recipientPublicKeyBase64
      );

      // Corrupt the encrypted data
      const corruptedData = new Uint8Array(encrypted.encryptedData);
      corruptedData[0] ^= 0xff;
      corruptedData[10] ^= 0xff;

      expect(() =>
        decryptFile({
          encryptedData: corruptedData,
          encryptedKey: encrypted.encryptedKey,
          ephemeralPublicKey: encrypted.ephemeralPublicKey,
          fileNonce: encrypted.fileNonce,
          keyNonce: encrypted.keyNonce,
          recipientSecretKey: recipientKeyPair.secretKey,
        })
      ).toThrow(DecryptionError);
    });

    it('should fail with corrupted encrypted key', async () => {
      const originalContent = new TextEncoder().encode('Corrupt key test');

      const encrypted = await encryptFile(
        originalContent,
        recipientPublicKeyBase64
      );

      // Corrupt the encrypted key
      const corruptedKey = encodeBase64(nacl.randomBytes(48));

      expect(() =>
        decryptFile({
          encryptedData: encrypted.encryptedData,
          encryptedKey: corruptedKey,
          ephemeralPublicKey: encrypted.ephemeralPublicKey,
          fileNonce: encrypted.fileNonce,
          keyNonce: encrypted.keyNonce,
          recipientSecretKey: recipientKeyPair.secretKey,
        })
      ).toThrow(DecryptionError);
    });

    it('should fail with empty encrypted data', () => {
      expect(() =>
        decryptFile({
          encryptedData: new Uint8Array(0),
          encryptedKey: encodeBase64(nacl.randomBytes(48)),
          ephemeralPublicKey: encodeBase64(nacl.randomBytes(32)),
          fileNonce: encodeBase64(nacl.randomBytes(24)),
          keyNonce: encodeBase64(nacl.randomBytes(24)),
          recipientSecretKey: recipientKeyPair.secretKey,
        })
      ).toThrow(DecryptionError);

      try {
        decryptFile({
          encryptedData: new Uint8Array(0),
          encryptedKey: encodeBase64(nacl.randomBytes(48)),
          ephemeralPublicKey: encodeBase64(nacl.randomBytes(32)),
          fileNonce: encodeBase64(nacl.randomBytes(24)),
          keyNonce: encodeBase64(nacl.randomBytes(24)),
          recipientSecretKey: recipientKeyPair.secretKey,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DecryptionError);
        expect((error as DecryptionError).code).toBe('DECRYPT_EMPTY_DATA');
      }
    });

    it('should fail with invalid secret key length', async () => {
      const originalContent = new TextEncoder().encode('Test');

      const encrypted = await encryptFile(
        originalContent,
        recipientPublicKeyBase64
      );

      const shortSecretKey = new Uint8Array(16); // Too short

      expect(() =>
        decryptFile({
          encryptedData: encrypted.encryptedData,
          encryptedKey: encrypted.encryptedKey,
          ephemeralPublicKey: encrypted.ephemeralPublicKey,
          fileNonce: encrypted.fileNonce,
          keyNonce: encrypted.keyNonce,
          recipientSecretKey: shortSecretKey,
        })
      ).toThrow(DecryptionError);

      try {
        decryptFile({
          encryptedData: encrypted.encryptedData,
          encryptedKey: encrypted.encryptedKey,
          ephemeralPublicKey: encrypted.ephemeralPublicKey,
          fileNonce: encrypted.fileNonce,
          keyNonce: encrypted.keyNonce,
          recipientSecretKey: shortSecretKey,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DecryptionError);
        expect((error as DecryptionError).code).toBe('DECRYPT_INVALID_KEY');
      }
    });

    it('should fail with wrong nonce', async () => {
      const originalContent = new TextEncoder().encode('Nonce test');

      const encrypted = await encryptFile(
        originalContent,
        recipientPublicKeyBase64
      );

      // Use wrong file nonce
      const wrongFileNonce = encodeBase64(nacl.randomBytes(24));

      expect(() =>
        decryptFile({
          encryptedData: encrypted.encryptedData,
          encryptedKey: encrypted.encryptedKey,
          ephemeralPublicKey: encrypted.ephemeralPublicKey,
          fileNonce: wrongFileNonce,
          keyNonce: encrypted.keyNonce,
          recipientSecretKey: recipientKeyPair.secretKey,
        })
      ).toThrow(DecryptionError);
    });

    it('should handle large file round-trip', async () => {
      // 1MB file
      const largeContent = nacl.randomBytes(1024 * 1024);

      const encrypted = await encryptFile(largeContent, recipientPublicKeyBase64);

      const decrypted = decryptFile({
        encryptedData: encrypted.encryptedData,
        encryptedKey: encrypted.encryptedKey,
        ephemeralPublicKey: encrypted.ephemeralPublicKey,
        fileNonce: encrypted.fileNonce,
        keyNonce: encrypted.keyNonce,
        recipientSecretKey: recipientKeyPair.secretKey,
      });

      expect(decrypted).toEqual(largeContent);
    });
  });

  describe('verifyContentHash', () => {
    it('should verify matching hash', async () => {
      const content = new TextEncoder().encode('Verify me');
      const hash = await hashContent(content);

      const isValid = await verifyContentHash(content, hash);
      expect(isValid).toBe(true);
    });

    it('should reject non-matching hash', async () => {
      const content = new TextEncoder().encode('Original');
      const wrongHash =
        '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      const isValid = await verifyContentHash(content, wrongHash);
      expect(isValid).toBe(false);
    });

    it('should handle case-insensitive hash comparison', async () => {
      const content = new TextEncoder().encode('Case test');
      const hash = await hashContent(content);
      const upperHash = hash.toUpperCase();

      const isValid = await verifyContentHash(content, upperHash);
      expect(isValid).toBe(true);
    });
  });

  describe('encryption workflow', () => {
    it('should support multiple recipients with different keys', async () => {
      const content = new TextEncoder().encode('Shared evidence');

      const recipient1 = nacl.box.keyPair();
      const recipient2 = nacl.box.keyPair();

      // Encrypt for recipient 1
      const encrypted1 = await encryptFile(
        content,
        encodeBase64(recipient1.publicKey)
      );

      // Encrypt for recipient 2
      const encrypted2 = await encryptFile(
        content,
        encodeBase64(recipient2.publicKey)
      );

      // Each recipient can decrypt their copy
      const decrypted1 = decryptFile({
        encryptedData: encrypted1.encryptedData,
        encryptedKey: encrypted1.encryptedKey,
        ephemeralPublicKey: encrypted1.ephemeralPublicKey,
        fileNonce: encrypted1.fileNonce,
        keyNonce: encrypted1.keyNonce,
        recipientSecretKey: recipient1.secretKey,
      });

      const decrypted2 = decryptFile({
        encryptedData: encrypted2.encryptedData,
        encryptedKey: encrypted2.encryptedKey,
        ephemeralPublicKey: encrypted2.ephemeralPublicKey,
        fileNonce: encrypted2.fileNonce,
        keyNonce: encrypted2.keyNonce,
        recipientSecretKey: recipient2.secretKey,
      });

      expect(Buffer.from(decrypted1).toString('hex')).toBe(
        Buffer.from(content).toString('hex')
      );
      expect(Buffer.from(decrypted2).toString('hex')).toBe(
        Buffer.from(content).toString('hex')
      );

      // Recipient 1 cannot decrypt recipient 2's copy
      expect(() =>
        decryptFile({
          encryptedData: encrypted2.encryptedData,
          encryptedKey: encrypted2.encryptedKey,
          ephemeralPublicKey: encrypted2.ephemeralPublicKey,
          fileNonce: encrypted2.fileNonce,
          keyNonce: encrypted2.keyNonce,
          recipientSecretKey: recipient1.secretKey,
        })
      ).toThrow(DecryptionError);
    });
  });
});

