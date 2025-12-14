import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { Errors } from '../middleware/error.js';
import { requireAuth, getAuthUser } from '../middleware/auth.js';

// Import schemas and constants from shared package (single source of truth)
import {
  uploadRequestSchema,
  EVIDENCE_CATEGORIES,
} from '@witnesschain/shared';

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
 * Upload new evidence
 * POST /api/evidence
 * 
 * Requires authentication via requireAuth middleware.
 * Uses shared uploadRequestSchema for validation (single source of truth).
 */
evidenceRoutes.post(
  '/',
  requireAuth,
  zValidator('json', uploadRequestSchema),
  async (c) => {
    const user = getAuthUser(c);

    // TODO: Implement evidence upload in Phase 4 (Filecoin storage)
    const evidenceId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    return c.json(
      {
        success: true,
        data: {
          evidenceId,
          userId: user.did,
          pieceCid: 'placeholder_piece_cid',
          txHash: '0x' + '0'.repeat(64),
          status: 'pending',
        },
      },
      201
    );
  }
);

/**
 * List evidence for current user
 * GET /api/evidence
 * 
 * Requires authentication via requireAuth middleware.
 */
evidenceRoutes.get(
  '/',
  requireAuth,
  zValidator('query', listSchema),
  async (c) => {
    const { page, limit } = c.req.valid('query');
    const user = getAuthUser(c);

    // TODO: Implement evidence listing in Phase 6
    // Will query evidence table filtering by user.did
    return c.json({
      success: true,
      data: {
        userId: user.did,
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      },
    });
  }
);

/**
 * Get evidence by ID
 * GET /api/evidence/:id
 * 
 * Requires authentication via requireAuth middleware.
 * Only returns evidence owned by the authenticated user.
 */
evidenceRoutes.get('/:id', requireAuth, async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const user = getAuthUser(c);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const evidenceId = c.req.param('id');

  // TODO: Implement evidence lookup in Phase 6
  // Must verify user.did owns this evidence before returning
  throw Errors.notFound('Evidence');
});

/**
 * Download evidence file
 * GET /api/evidence/:id/download
 * 
 * Requires authentication via requireAuth middleware.
 * Only allows download of evidence owned by the authenticated user.
 */
evidenceRoutes.get('/:id/download', requireAuth, async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const user = getAuthUser(c);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const evidenceId = c.req.param('id');

  // TODO: Implement evidence download in Phase 4 (Filecoin retrieval)
  // Must verify user.did owns this evidence before allowing download
  throw Errors.notFound('Evidence');
});
