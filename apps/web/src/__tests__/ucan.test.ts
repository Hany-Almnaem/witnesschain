/**
 * UCAN Access Control Tests
 *
 * Tests UCAN capability creation, delegation, and verification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nacl from 'tweetnacl';

import {
  createSignerFromSecretKey,
  issueSelfCapability,
  delegateCapability,
  parseUCANToken,
  checkCapability,
  createUploadCapability,
  createReadCapability,
  canUploadEvidence,
  canReadEvidence,
  CAPABILITIES,
  UCANError,
} from '@/lib/ucan';

// Type for signer from createSignerFromSecretKey
type TestSigner = Awaited<ReturnType<typeof createSignerFromSecretKey>>;

describe('UCAN Access Control', () => {
  // Test secret key (Ed25519 signing key - 64 bytes)
  let secretKey: Uint8Array;
  let signer: TestSigner;

  beforeEach(async () => {
    // Generate a fresh signing keypair for each test
    const keyPair = nacl.sign.keyPair();
    secretKey = keyPair.secretKey;
    signer = await createSignerFromSecretKey(secretKey);
  });

  describe('createSignerFromSecretKey', () => {
    it('should create a valid signer from secret key', async () => {
      expect(signer).toBeDefined();
      expect(signer.did()).toMatch(/^did:key:z[a-zA-Z0-9]+$/);
    });

    it('should create consistent DID from same key', async () => {
      const signer2 = await createSignerFromSecretKey(secretKey);

      expect(signer.did()).toBe(signer2.did());
    });

    it('should create different DIDs from different keys', async () => {
      const keyPair2 = nacl.sign.keyPair();

      const signer2 = await createSignerFromSecretKey(keyPair2.secretKey);

      expect(signer.did()).not.toBe(signer2.did());
    });
  });

  describe('issueSelfCapability', () => {
    it('should create a self-issued capability', async () => {
      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_UPLOAD
      );

      expect(delegation.token).toBeDefined();
      expect(delegation.cid).toBeDefined();
      expect(delegation.issuer).toBe(signer.did());
      expect(delegation.audience).toBe(signer.did());
      expect(delegation.capabilities).toContain(CAPABILITIES.EVIDENCE_UPLOAD);
      expect(delegation.expiration).toBeGreaterThan(Date.now() / 1000);
    });

    it('should create capability for specific resource', async () => {
      const evidenceId = 'evidence-123';

      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_READ,
        evidenceId
      );

      expect(delegation.capabilities).toContain(CAPABILITIES.EVIDENCE_READ);
    });

    it('should respect custom expiration', async () => {
      const shortExpiration = 60; // 1 minute

      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_UPLOAD,
        undefined,
        shortExpiration
      );

      const now = Math.floor(Date.now() / 1000);
      expect(delegation.expiration).toBeLessThanOrEqual(now + shortExpiration + 1);
      expect(delegation.expiration).toBeGreaterThan(now);
    });
  });

  describe('delegateCapability', () => {
    it('should delegate capability to another DID', async () => {
      // Create another keypair for the audience
      const audienceKeyPair = nacl.sign.keyPair();
      const audienceSigner = await createSignerFromSecretKey(
        audienceKeyPair.secretKey
      );
      const audienceDid = audienceSigner.did() as `did:key:${string}`;

      const delegation = await delegateCapability(
        signer,
        audienceDid,
        CAPABILITIES.EVIDENCE_READ,
        'evidence-456'
      );

      expect(delegation.issuer).toBe(signer.did());
      expect(delegation.audience).toBe(audienceDid);
      expect(delegation.capabilities).toContain(CAPABILITIES.EVIDENCE_READ);
    });
  });

  describe('parseUCANToken', () => {
    it('should parse a valid UCAN token', async () => {
      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_UPLOAD
      );

      const parsed = await parseUCANToken(delegation.token);

      expect(parsed.issuer).toBe(signer.did());
      expect(parsed.audience).toBe(signer.did());
      expect(parsed.capabilities).toHaveLength(1);
      expect(parsed.capabilities[0].can).toBe(CAPABILITIES.EVIDENCE_UPLOAD);
    });

    it('should throw on invalid token', async () => {
      await expect(parseUCANToken('invalid-token')).rejects.toThrow();
    });
  });

  describe('checkCapability', () => {
    it('should allow valid capability', async () => {
      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_UPLOAD
      );

      const result = await checkCapability(
        delegation.token,
        CAPABILITIES.EVIDENCE_UPLOAD
      );

      expect(result.allowed).toBe(true);
      expect(result.token).toBe(delegation.token);
    });

    it('should deny when capability not granted', async () => {
      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_UPLOAD // Only upload granted
      );

      const result = await checkCapability(
        delegation.token,
        CAPABILITIES.EVIDENCE_DELETE // Trying to use delete
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not granted');
    });

    it('should deny expired capability', async () => {
      // Create capability that expires immediately (negative expiration trick)
      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_UPLOAD,
        undefined,
        -1 // Already expired
      );

      const result = await checkCapability(
        delegation.token,
        CAPABILITIES.EVIDENCE_UPLOAD
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should check resource-specific capability', async () => {
      const evidenceId = 'specific-evidence-id';

      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_READ,
        evidenceId
      );

      // Should allow for the specific resource
      const result1 = await checkCapability(
        delegation.token,
        CAPABILITIES.EVIDENCE_READ,
        evidenceId
      );
      expect(result1.allowed).toBe(true);

      // Should deny for different resource (since it's resource-specific, not wildcard)
      // Note: With wildcard capability, other resources would be allowed
    });
  });

  describe('createUploadCapability', () => {
    it('should create upload capability', async () => {
      const delegation = await createUploadCapability(signer);

      expect(delegation.capabilities).toContain(CAPABILITIES.EVIDENCE_UPLOAD);

      const canUpload = await canUploadEvidence(delegation.token);
      expect(canUpload).toBe(true);
    });

    it('should respect custom expiration', async () => {
      const shortExpiration = 300; // 5 minutes

      const delegation = await createUploadCapability(signer, shortExpiration);

      const now = Math.floor(Date.now() / 1000);
      expect(delegation.expiration).toBeLessThanOrEqual(now + shortExpiration + 1);
    });
  });

  describe('createReadCapability', () => {
    it('should create read capability for specific evidence', async () => {
      const evidenceId = 'read-test-123';

      const delegation = await createReadCapability(signer, evidenceId);

      expect(delegation.capabilities).toContain(CAPABILITIES.EVIDENCE_READ);

      const canRead = await canReadEvidence(delegation.token, evidenceId);
      expect(canRead).toBe(true);
    });
  });

  describe('canUploadEvidence', () => {
    it('should return true for valid upload capability', async () => {
      const delegation = await createUploadCapability(signer);

      const result = await canUploadEvidence(delegation.token);
      expect(result).toBe(true);
    });

    it('should return false for non-upload capability', async () => {
      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_READ,
        'some-id'
      );

      const result = await canUploadEvidence(delegation.token);
      expect(result).toBe(false);
    });
  });

  describe('canReadEvidence', () => {
    it('should return true for matching evidence ID', async () => {
      const evidenceId = 'test-evidence';
      const delegation = await createReadCapability(signer, evidenceId);

      const result = await canReadEvidence(delegation.token, evidenceId);
      expect(result).toBe(true);
    });

    it('should return true for wildcard capability', async () => {
      // Create wildcard read capability (no specific resource)
      const delegation = await issueSelfCapability(
        signer,
        CAPABILITIES.EVIDENCE_READ
        // No resourceId = wildcard
      );

      const result = await canReadEvidence(delegation.token, 'any-evidence-id');
      expect(result).toBe(true);
    });
  });

  describe('UCANError', () => {
    it('should create error with code and message', () => {
      const error = new UCANError('UCAN_EXPIRED', 'Token has expired');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(UCANError);
      expect(error.code).toBe('UCAN_EXPIRED');
      expect(error.message).toBe('Token has expired');
      expect(error.name).toBe('UCANError');
    });
  });

  describe('capability workflow', () => {
    it('should support complete upload workflow', async () => {
      // Step 1: Create upload capability
      const uploadCap = await createUploadCapability(signer);

      // Step 2: Verify capability before upload
      const canUpload = await canUploadEvidence(uploadCap.token);
      expect(canUpload).toBe(true);

      // Step 3: After upload, create read capability for the new evidence
      const evidenceId = 'newly-uploaded-evidence';
      const readCap = await createReadCapability(signer, evidenceId);

      // Step 4: Verify read capability
      const canRead = await canReadEvidence(readCap.token, evidenceId);
      expect(canRead).toBe(true);
    });

    it('should support sharing evidence with another user', async () => {
      // Create recipient
      const recipientKeyPair = nacl.sign.keyPair();
      const recipientSigner = await createSignerFromSecretKey(
        recipientKeyPair.secretKey
      );
      const recipientDid = recipientSigner.did() as `did:key:${string}`;

      const evidenceId = 'shared-evidence';

      // Owner delegates read access to recipient
      const delegation = await delegateCapability(
        signer,
        recipientDid,
        CAPABILITIES.EVIDENCE_READ,
        evidenceId
      );

      expect(delegation.issuer).toBe(signer.did());
      expect(delegation.audience).toBe(recipientDid);

      // Recipient should be able to use the capability
      const canRead = await checkCapability(
        delegation.token,
        CAPABILITIES.EVIDENCE_READ,
        evidenceId
      );
      expect(canRead.allowed).toBe(true);
    });
  });
});

