import { zValidator } from '@hono/zod-validator';
import {
  uploadRequestSchema,
  EVIDENCE_CATEGORIES,
} from '@witnesschain/shared';
import { eq, and, desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { db, evidence, accessLogs } from '../db/index.js';
import { validateCid, sanitizeCidForLog } from '../lib/cid-validation.js';
import { registerEvidenceOnChain, isContractAvailable } from '../lib/fvm.js';
import { StorageError } from '../lib/storage-errors.js';
import { uploadToFilecoin, retrieveFromFilecoin } from '../lib/storage.js';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { Errors, ApiError } from '../middleware/error.js';


export const evidenceRoutes = new Hono();

/**
 * List evidence schema
 */
const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.enum(EVIDENCE_CATEGORIES).optional(),
  status: z
    .enum(['pending', 'uploading', 'stored', 'timestamped', 'verified', 'rejected'])
    .optional(),
});

/**
 * Schema for upload with encrypted data
 * The encrypted data is sent as base64 in the request body
 */
const uploadWithDataSchema = uploadRequestSchema.extend({
  encryptedData: z.string().min(1, 'Encrypted data is required'),
});

/**
 * Upload new evidence
 * POST /api/evidence
 *
 * Receives encrypted evidence from client and stores it on Filecoin.
 * The file is already encrypted client-side - we just store the encrypted bytes.
 */
evidenceRoutes.post(
  '/',
  requireAuth,
  zValidator('json', uploadWithDataSchema),
  async (c) => {
    const user = getAuthUser(c);
    const body = c.req.valid('json');

    // Generate unique evidence ID
    const evidenceId = uuidv4();

    // Decode base64 encrypted data
    let encryptedData: Uint8Array;
    try {
      const binaryString = atob(body.encryptedData);
      encryptedData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        encryptedData[i] = binaryString.charCodeAt(i);
      }
    } catch {
      throw Errors.badRequest('Invalid encrypted data format');
    }

    // Validate encrypted data size matches claimed file size (with encryption overhead)
    const encryptionOverhead = 16 + 24; // Poly1305 tag + nonce overhead
    const expectedMinSize = body.file.size + encryptionOverhead - 100; // Allow some variance
    const expectedMaxSize = body.file.size + encryptionOverhead + 100;

    if (encryptedData.length < expectedMinSize || encryptedData.length > expectedMaxSize + 1000) {
      console.warn(
        `[Evidence] Size mismatch: encrypted=${encryptedData.length}, claimed=${body.file.size}`
      );
      // Log but don't reject - encryption overhead varies
    }

    console.info(`[Evidence] Creating evidence record: ${evidenceId}`);
    console.info(`[Evidence] User: ${user.did}`);
    console.info(`[Evidence] File: ${body.file.name} (${body.file.size} bytes)`);

    try {
      // Create initial evidence record with 'uploading' status
      await db.insert(evidence).values({
        id: evidenceId,
        userId: user.did,
        title: body.metadata.title,
        description: body.metadata.description ?? null,
        category: body.metadata.category,
        encryptedKey: body.encryption.encryptedKey,
        ephemeralPublicKey: body.encryption.ephemeralPublicKey,
        fileNonce: body.encryption.fileNonce,
        keyNonce: body.encryption.keyNonce,
        fileSize: body.file.size,
        mimeType: body.file.type,
        contentHash: body.encryption.contentHash,
        status: 'uploading',
        metadata: {
          source: body.metadata.source,
          location: body.metadata.location,
          date: body.metadata.date,
          contentWarnings: body.metadata.contentWarnings,
          tags: body.metadata.tags,
        },
      });

      // Upload to Filecoin
      const uploadResult = await uploadToFilecoin(encryptedData, {
        evidenceId,
        contentHash: body.encryption.contentHash,
      });

      // Validate the returned CID
      const cidValidation = validateCid(uploadResult.pieceCid);
      if (!cidValidation.isValid) {
        console.error(
          `[Evidence] Invalid CID returned: ${sanitizeCidForLog(uploadResult.pieceCid)}`
        );
        // Update status to error
        await db
          .update(evidence)
          .set({
            status: 'rejected',
            updatedAt: new Date(),
          })
          .where(eq(evidence.id, evidenceId));

        throw new ApiError(
          500,
          'STORAGE_ERROR',
          'Failed to store evidence. Please try again.',
          'Invalid CID returned from storage'
        );
      }

      // Update evidence record with storage info
      await db
        .update(evidence)
        .set({
          pieceCid: uploadResult.pieceCid,
          dataSetId: uploadResult.dataSetId,
          providerAddress: uploadResult.providerAddress,
          filPaid: uploadResult.filPaid,
          status: 'stored',
          updatedAt: new Date(),
        })
        .where(eq(evidence.id, evidenceId));

      console.info(`[Evidence] Successfully stored: ${evidenceId}`);
      console.info(`[Evidence] PieceCID: ${sanitizeCidForLog(uploadResult.pieceCid)}`);

      // Attempt on-chain registration if contract is available
      let txHash: string | null = null;
      let blockNumber: number | null = null;
      let onChainTimestamp: number | null = null;
      let finalStatus = 'stored';

      const contractAvailable = await isContractAvailable();
      if (contractAvailable) {
        console.info(`[Evidence] Registering on-chain: ${evidenceId}`);

        const registrationResult = await registerEvidenceOnChain(
          evidenceId,
          body.encryption.contentHash,
          uploadResult.pieceCid,
          uploadResult.providerAddress ?? 'f0unknown'
        );

        if (registrationResult.success) {
          txHash = registrationResult.txHash ?? null;
          blockNumber = registrationResult.blockNumber ?? null;
          onChainTimestamp = registrationResult.timestamp ?? null;
          finalStatus = 'timestamped';

          console.info(`[Evidence] On-chain registration successful: ${txHash}`);

          // Update with on-chain info
          await db
            .update(evidence)
            .set({
              txHash,
              blockNumber,
              onChainTimestamp,
              status: finalStatus,
              updatedAt: new Date(),
            })
            .where(eq(evidence.id, evidenceId));
        } else {
          console.warn(`[Evidence] On-chain registration failed: ${registrationResult.error}`);
          // Evidence is still stored, just not timestamped
          // Status remains 'stored' - can be retried later
        }
      } else {
        console.info('[Evidence] On-chain registration skipped - contract not available');
      }

      return c.json(
        {
          success: true,
          data: {
            evidenceId,
            userId: user.did,
            pieceCid: uploadResult.pieceCid,
            contentHash: body.encryption.contentHash,
            filPaid: uploadResult.filPaid,
            status: finalStatus,
            txHash,
            blockNumber,
            onChainTimestamp,
          },
        },
        201
      );
    } catch (error) {
      // Update status to error if storage failed
      await db
        .update(evidence)
        .set({
          status: 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(evidence.id, evidenceId))
        .catch(() => {
          // Ignore update errors during error handling
        });

      // Re-throw StorageErrors with proper status
      if (error instanceof StorageError) {
        throw new ApiError(
          500,
          error.code,
          error.userMessage,
          error.technicalMessage
        );
      }

      // Re-throw ApiErrors
      if (error instanceof ApiError) {
        throw error;
      }

      console.error('[Evidence] Upload failed:', error);
      throw Errors.internalError();
    }
  }
);

/**
 * List evidence for current user
 * GET /api/evidence
 */
evidenceRoutes.get(
  '/',
  requireAuth,
  zValidator('query', listSchema),
  async (c) => {
    const { page, limit, category, status } = c.req.valid('query');
    const user = getAuthUser(c);

    // Build query conditions
    const conditions = [eq(evidence.userId, user.did)];

    if (category) {
      conditions.push(eq(evidence.category, category));
    }

    if (status) {
      conditions.push(eq(evidence.status, status));
    }

    // Query evidence with pagination
    const offset = (page - 1) * limit;

    const [items, countResult] = await Promise.all([
      db
        .select({
          id: evidence.id,
          title: evidence.title,
          category: evidence.category,
          pieceCid: evidence.pieceCid,
          contentHash: evidence.contentHash,
          fileSize: evidence.fileSize,
          mimeType: evidence.mimeType,
          status: evidence.status,
          filPaid: evidence.filPaid,
          txHash: evidence.txHash,
          createdAt: evidence.createdAt,
        })
        .from(evidence)
        .where(and(...conditions))
        .orderBy(desc(evidence.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: evidence.id })
        .from(evidence)
        .where(and(...conditions)),
    ]);

    const total = countResult.length;
    const totalPages = Math.ceil(total / limit);

    return c.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  }
);

/**
 * Get evidence by ID
 * GET /api/evidence/:id
 */
evidenceRoutes.get('/:id', requireAuth, async (c) => {
  const user = getAuthUser(c);
  const evidenceId = c.req.param('id');

  // Fetch evidence record
  const [record] = await db
    .select()
    .from(evidence)
    .where(eq(evidence.id, evidenceId))
    .limit(1);

  if (!record) {
    throw Errors.notFound('Evidence');
  }

  // Verify ownership
  if (record.userId !== user.did) {
    throw Errors.forbidden('You do not have access to this evidence.');
  }

  // Log access
  await db.insert(accessLogs).values({
    id: uuidv4(),
    evidenceId,
    userId: user.did,
    action: 'view',
  });

  return c.json({
    success: true,
    data: {
      id: record.id,
      title: record.title,
      description: record.description,
      category: record.category,
      pieceCid: record.pieceCid,
      dataSetId: record.dataSetId,
      providerAddress: record.providerAddress,
      contentHash: record.contentHash,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      status: record.status,
      filPaid: record.filPaid,
      txHash: record.txHash,
      blockNumber: record.blockNumber,
      onChainTimestamp: record.onChainTimestamp,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      // Encryption info needed for decryption
      encryption: {
        encryptedKey: record.encryptedKey,
        ephemeralPublicKey: record.ephemeralPublicKey,
        fileNonce: record.fileNonce,
        keyNonce: record.keyNonce,
      },
    },
  });
});

/**
 * Download evidence file
 * GET /api/evidence/:id/download
 *
 * Returns the encrypted file data. Client is responsible for decryption.
 */
evidenceRoutes.get('/:id/download', requireAuth, async (c) => {
  const user = getAuthUser(c);
  const evidenceId = c.req.param('id');

  // Fetch evidence record
  const [record] = await db
    .select()
    .from(evidence)
    .where(eq(evidence.id, evidenceId))
    .limit(1);

  if (!record) {
    throw Errors.notFound('Evidence');
  }

  // Verify ownership
  if (record.userId !== user.did) {
    throw Errors.forbidden('You do not have access to this evidence.');
  }

  // Check if stored
  if (!record.pieceCid) {
    throw Errors.badRequest('Evidence has not been stored yet.');
  }

  // Validate CID before retrieval
  const cidValidation = validateCid(record.pieceCid);
  if (!cidValidation.isValid) {
    console.error(
      `[Evidence] Invalid stored CID: ${sanitizeCidForLog(record.pieceCid)}`
    );
    throw new ApiError(
      500,
      'STORAGE_ERROR',
      'Evidence storage identifier is invalid.',
      'Invalid CID in database'
    );
  }

  console.info(`[Evidence] Downloading: ${evidenceId}`);
  console.info(`[Evidence] PieceCID: ${sanitizeCidForLog(record.pieceCid)}`);

  try {
    // Retrieve from Filecoin
    const encryptedData = await retrieveFromFilecoin(record.pieceCid);

    // Log download access
    await db.insert(accessLogs).values({
      id: uuidv4(),
      evidenceId,
      userId: user.did,
      action: 'download',
    });

    console.info(`[Evidence] Downloaded ${encryptedData.length} bytes`);

    // Return encrypted data with metadata
    // Client will decrypt using their private key
    return c.json({
      success: true,
      data: {
        evidenceId,
        // Base64 encode for JSON transport
        encryptedData: btoa(String.fromCharCode(...encryptedData)),
        // Encryption params for client-side decryption
        encryption: {
          encryptedKey: record.encryptedKey,
          ephemeralPublicKey: record.ephemeralPublicKey,
          fileNonce: record.fileNonce,
          keyNonce: record.keyNonce,
          contentHash: record.contentHash,
        },
        file: {
          name: record.title, // Use title as filename since original name not stored
          size: record.fileSize,
          mimeType: record.mimeType,
        },
      },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      throw new ApiError(
        500,
        error.code,
        error.userMessage,
        error.technicalMessage
      );
    }

    if (error instanceof ApiError) {
      throw error;
    }

    console.error('[Evidence] Download failed:', error);
    throw Errors.internalError();
  }
});

/**
 * Get evidence upload status
 * GET /api/evidence/:id/status
 *
 * Returns current status of an evidence upload.
 * Useful for polling during upload process.
 */
evidenceRoutes.get('/:id/status', requireAuth, async (c) => {
  const user = getAuthUser(c);
  const evidenceId = c.req.param('id');

  // Fetch evidence record
  const [record] = await db
    .select({
      id: evidence.id,
      userId: evidence.userId,
      status: evidence.status,
      pieceCid: evidence.pieceCid,
      txHash: evidence.txHash,
      createdAt: evidence.createdAt,
      updatedAt: evidence.updatedAt,
    })
    .from(evidence)
    .where(eq(evidence.id, evidenceId))
    .limit(1);

  if (!record) {
    throw Errors.notFound('Evidence');
  }

  // Verify ownership
  if (record.userId !== user.did) {
    throw Errors.forbidden('You do not have access to this evidence.');
  }

  return c.json({
    success: true,
    data: {
      evidenceId: record.id,
      status: record.status,
      pieceCid: record.pieceCid,
      txHash: record.txHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  });
});
