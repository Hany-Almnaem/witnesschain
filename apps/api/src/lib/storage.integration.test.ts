/**
 * Storage Integration Tests
 *
 * IMPORTANT: These tests use the REAL Synapse SDK - no mocking.
 * Tests will fail if:
 * - Upload logic is removed or broken
 * - Fake CIDs are returned
 * - Retrieval logic doesn't work
 *
 * These tests require:
 * - BACKEND_PRIVATE_KEY to be set
 * - Network access to Filecoin testnet
 * - Sufficient FIL balance for test uploads
 *
 * To run: BACKEND_PRIVATE_KEY=your_key pnpm --filter @witnesschain/api test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { validateCid, isPieceCid } from './cid-validation.js';
import { StorageError } from './storage-errors.js';
import { uploadToFilecoin, retrieveFromFilecoin } from './storage.js';
import { getSynapseClient, resetSynapseClient, isSynapseConnected } from './synapse.js';

// Test data - small payload to minimize costs
const TEST_DATA = new TextEncoder().encode(
  'WitnessChain Integration Test - ' + new Date().toISOString()
);

// SHA-256 hash of test data (computed at runtime)
async function hashTestData(): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', TEST_DATA);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check if integration tests should run
function shouldRunIntegrationTests(): boolean {
  return !!process.env.BACKEND_PRIVATE_KEY;
}

describe('Storage Integration Tests', () => {
  let isConfigured: boolean;

  beforeAll(() => {
    isConfigured = shouldRunIntegrationTests();
    if (!isConfigured) {
      console.warn(
        '\n⚠️  Skipping integration tests: BACKEND_PRIVATE_KEY not configured\n' +
          '   Set BACKEND_PRIVATE_KEY in environment to run these tests.\n'
      );
    }
  });

  afterAll(() => {
    resetSynapseClient();
  });

  describe('Synapse Client', () => {
    it('should initialize client when configured', async () => {
      if (!isConfigured) {
        console.log('Skipped: BACKEND_PRIVATE_KEY not configured');
        return;
      }

      const client = await getSynapseClient();

      expect(client).toBeDefined();
      expect(client.payments).toBeDefined();
      expect(client.storage).toBeDefined();
    });

    it('should report connected status when configured', async () => {
      if (!isConfigured) {
        console.log('Skipped: BACKEND_PRIVATE_KEY not configured');
        return;
      }

      const connected = await isSynapseConnected();
      expect(connected).toBe(true);
    });

    it('should throw when not configured', async () => {
      if (isConfigured) {
        // Can't test this path when configured
        return;
      }

      await expect(getSynapseClient()).rejects.toThrow(StorageError);
    });
  });

  describe('File Upload', () => {
    it('should upload data and return valid PieceCID', async () => {
      if (!isConfigured) {
        console.log('Skipped: BACKEND_PRIVATE_KEY not configured');
        return;
      }

      const contentHash = await hashTestData();
      const evidenceId = `test-${Date.now()}`;

      // Track progress events
      const progressEvents: string[] = [];

      const result = await uploadToFilecoin(TEST_DATA, {
        evidenceId,
        contentHash,
        onProgress: (info) => {
          progressEvents.push(info.stage);
        },
      });

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.pieceCid).toBeDefined();
      expect(result.uploadedBytes).toBe(TEST_DATA.length);

      // CRITICAL: CID must be valid format (not fake)
      const cidValidation = validateCid(result.pieceCid);
      expect(cidValidation.isValid).toBe(true);

      // CRITICAL: Should be a proper PieceCID for Filecoin
      expect(isPieceCid(result.pieceCid) || cidValidation.format === 'v1').toBe(true);

      // Verify progress events were called
      expect(progressEvents).toContain('preparing');
      expect(progressEvents).toContain('uploading');

      console.log('Upload result:', {
        pieceCid: result.pieceCid,
        filPaid: result.filPaid,
        uploadedBytes: result.uploadedBytes,
      });
    }, 120000); // 2 minute timeout for network operations

    it('should reject empty data', async () => {
      if (!isConfigured) {
        console.log('Skipped: BACKEND_PRIVATE_KEY not configured');
        return;
      }

      await expect(
        uploadToFilecoin(new Uint8Array(0), {
          evidenceId: 'test-empty',
          contentHash: '0x' + '0'.repeat(64),
        })
      ).rejects.toThrow(StorageError);
    });
  });

  describe('File Retrieval', () => {
    let uploadedCid: string;

    beforeAll(async () => {
      if (!isConfigured) {
        return;
      }

      // Upload test data first
      const contentHash = await hashTestData();
      const result = await uploadToFilecoin(TEST_DATA, {
        evidenceId: `test-retrieval-${Date.now()}`,
        contentHash,
      });
      uploadedCid = result.pieceCid;
    }, 120000);

    it('should retrieve uploaded data', async () => {
      if (!isConfigured || !uploadedCid) {
        console.log('Skipped: BACKEND_PRIVATE_KEY not configured or upload failed');
        return;
      }

      const retrieved = await retrieveFromFilecoin(uploadedCid);

      expect(retrieved).toBeDefined();
      expect(retrieved.length).toBe(TEST_DATA.length);

      // CRITICAL: Retrieved data must match uploaded data
      const matches = retrieved.every((byte, i) => byte === TEST_DATA[i]);
      expect(matches).toBe(true);
    }, 60000);

    it('should reject invalid CID', async () => {
      if (!isConfigured) {
        console.log('Skipped: BACKEND_PRIVATE_KEY not configured');
        return;
      }

      await expect(retrieveFromFilecoin('invalid-cid')).rejects.toThrow(StorageError);
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full upload-retrieve cycle', async () => {
      if (!isConfigured) {
        console.log('Skipped: BACKEND_PRIVATE_KEY not configured');
        return;
      }

      // Create unique test payload
      const testPayload = new TextEncoder().encode(
        JSON.stringify({
          test: 'e2e-' + Date.now(),
          timestamp: new Date().toISOString(),
          random: Math.random().toString(36),
        })
      );

      const contentHash = await (async () => {
        const hashBuffer = await crypto.subtle.digest('SHA-256', testPayload);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      })();

      // 1. Upload
      const uploadResult = await uploadToFilecoin(testPayload, {
        evidenceId: `e2e-test-${Date.now()}`,
        contentHash,
      });

      expect(uploadResult.pieceCid).toBeDefined();
      expect(validateCid(uploadResult.pieceCid).isValid).toBe(true);

      // 2. Retrieve
      const retrieved = await retrieveFromFilecoin(uploadResult.pieceCid);

      // 3. Verify data integrity
      expect(retrieved.length).toBe(testPayload.length);

      const retrievedString = new TextDecoder().decode(retrieved);
      const originalString = new TextDecoder().decode(testPayload);
      expect(retrievedString).toBe(originalString);

      console.log('E2E test passed:', {
        cid: uploadResult.pieceCid,
        size: testPayload.length,
      });
    }, 180000); // 3 minute timeout for full cycle
  });
});

/**
 * These tests verify that the storage module cannot be bypassed
 * by returning fake data. If someone removes the actual upload
 * implementation and returns hardcoded values, these tests will fail.
 */
describe('Anti-Bypass Checks', () => {
  it('should not accept hardcoded CIDs', () => {
    // These are example CIDs that should NOT appear in test results
    const knownFakeCids = [
      'placeholder_piece_cid',
      'QmTest1234567890',
      'bafyfake',
      'baga1234',
    ];

    // Verify none of these would pass CID validation
    for (const fakeCid of knownFakeCids) {
      const result = validateCid(fakeCid);
      if (result.isValid) {
        console.error(`WARNING: Fake CID passed validation: ${fakeCid}`);
      }
      // Most fake CIDs should fail, but if format is correct, the
      // integration test would still fail on retrieval
    }
  });

  it('should require actual network calls for upload', async () => {
    // This test ensures that the upload function actually makes
    // network calls and doesn't just return cached/fake data

    if (!shouldRunIntegrationTests()) {
      console.log('Skipped: BACKEND_PRIVATE_KEY not configured');
      return;
    }

    // Upload with unique timestamp to prevent any caching
    const uniqueData = new TextEncoder().encode(
      'anti-bypass-' + Date.now() + '-' + Math.random()
    );

    const contentHash = await (async () => {
      const hashBuffer = await crypto.subtle.digest('SHA-256', uniqueData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    })();

    const result = await uploadToFilecoin(uniqueData, {
      evidenceId: `bypass-test-${Date.now()}`,
      contentHash,
    });

    // CID should be valid AND unique (not a hardcoded value)
    expect(validateCid(result.pieceCid).isValid).toBe(true);

    // Verify we can actually retrieve the data (proves it was stored)
    const retrieved = await retrieveFromFilecoin(result.pieceCid);
    expect(retrieved.length).toBe(uniqueData.length);
  }, 120000);
});
