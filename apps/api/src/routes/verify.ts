import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

export const verifyRoutes = new Hono();

/**
 * Verification request schema
 */
const verifySchema = z.object({
  evidenceId: z.string().min(1, 'Evidence ID is required'),
  contentHash: z.string().regex(/^0x[a-f0-9]{64}$/, 'Invalid content hash'),
});

/**
 * Verify evidence on-chain
 * POST /api/verify
 */
verifyRoutes.post('/', zValidator('json', verifySchema), (c) => {
  const { evidenceId } = c.req.valid('json');

  // TODO: Implement on-chain verification in Phase 5
  
  return c.json({
    success: true,
    data: {
      evidenceId,
      verified: false,
      message: 'Verification not yet implemented',
    },
  });
});

/**
 * Get verification status
 * GET /api/verify/:evidenceId
 */
verifyRoutes.get('/:evidenceId', (c) => {
  const evidenceId = c.req.param('evidenceId');

  // TODO: Implement verification status lookup in Phase 5-6
  
  return c.json({
    success: true,
    data: {
      evidenceId,
      status: 'pending',
      onChain: null,
      timestamp: null,
    },
  });
});

/**
 * Verify content hash against on-chain record
 * POST /api/verify/hash
 */
verifyRoutes.post(
  '/hash',
  zValidator(
    'json',
    z.object({
      contentHash: z.string().regex(/^0x[a-f0-9]{64}$/, 'Invalid content hash'),
    })
  ),
  (c) => {
    const { contentHash } = c.req.valid('json');

    // TODO: Implement hash verification in Phase 5
    
    return c.json({
      success: true,
      data: {
        contentHash,
        found: false,
        evidence: null,
      },
    });
  }
);
