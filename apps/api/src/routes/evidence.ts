import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { Errors } from '../middleware/error.js';

// Import constants from shared package
import {
  ALLOWED_FILE_TYPES,
  EVIDENCE_CATEGORIES,
  SOURCE_TYPES,
  CONTENT_WARNINGS,
  FILE_SIZE_LIMITS,
} from '@witnesschain/shared';

export const evidenceRoutes = new Hono();

/**
 * Evidence upload schema
 */
const uploadSchema = z.object({
  file: z.object({
    name: z.string().min(1).max(255),
    size: z
      .number()
      .min(FILE_SIZE_LIMITS.MIN_BYTES, 'File must be at least 127 bytes')
      .max(FILE_SIZE_LIMITS.MAX_BYTES, 'File must be less than 200MB'),
    type: z.enum(ALLOWED_FILE_TYPES, {
      errorMap: () => ({ message: 'File type not supported' }),
    }),
  }),
  metadata: z.object({
    title: z
      .string()
      .min(5, 'Title must be at least 5 characters')
      .max(200, 'Title must be less than 200 characters')
      .regex(/^[^<>{}]*$/, 'Title contains invalid characters'),
    description: z
      .string()
      .min(20, 'Description must be at least 20 characters')
      .max(5000, 'Description must be less than 5000 characters')
      .optional(),
    category: z.enum(EVIDENCE_CATEGORIES),
    location: z
      .object({
        description: z.string().max(500).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      })
      .optional(),
    date: z
      .object({
        occurred: z.string().datetime().optional(),
        approximate: z.string().max(100).optional(),
      })
      .optional(),
    source: z.object({
      type: z.enum(SOURCE_TYPES),
      name: z.string().max(200).optional(),
    }),
    contentWarnings: z.array(z.enum(CONTENT_WARNINGS)).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),
  encryption: z.object({
    encryptedKey: z.string().min(1, 'Encrypted key is required'),
    nonce: z.string().min(1, 'Nonce is required'),
    contentHash: z.string().regex(/^0x[a-f0-9]{64}$/, 'Invalid content hash'),
  }),
});

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
 * Upload new evidence
 * POST /api/evidence
 */
evidenceRoutes.post('/', zValidator('json', uploadSchema), async (c) => {
  const did = c.req.header('X-DID');

  if (!did) {
    throw Errors.unauthorized('Authentication required');
  }

  // TODO: Implement evidence upload in Phase 3-4
  const evidenceId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  return c.json(
    {
      success: true,
      data: {
        evidenceId,
        pieceCid: 'placeholder_piece_cid',
        txHash: '0x' + '0'.repeat(64),
        status: 'pending',
      },
    },
    201
  );
});

/**
 * List evidence for current user
 * GET /api/evidence
 */
evidenceRoutes.get('/', zValidator('query', listSchema), async (c) => {
  const { page, limit } = c.req.valid('query');
  const did = c.req.header('X-DID');

  if (!did) {
    throw Errors.unauthorized('Authentication required');
  }

  // TODO: Implement evidence listing in Phase 6
  return c.json({
    success: true,
    data: {
      items: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    },
  });
});

/**
 * Get evidence by ID
 * GET /api/evidence/:id
 */
evidenceRoutes.get('/:id', async (c) => {
  const did = c.req.header('X-DID');

  if (!did) {
    throw Errors.unauthorized('Authentication required');
  }

  // TODO: Implement evidence lookup in Phase 6
  throw Errors.notFound('Evidence');
});

/**
 * Download evidence file
 * GET /api/evidence/:id/download
 */
evidenceRoutes.get('/:id/download', async (c) => {
  const did = c.req.header('X-DID');

  if (!did) {
    throw Errors.unauthorized('Authentication required');
  }

  // TODO: Implement evidence download in Phase 4
  throw Errors.notFound('Evidence');
});
