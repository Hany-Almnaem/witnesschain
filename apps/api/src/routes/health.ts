import { Hono } from 'hono';

import { isDatabaseConnected } from '../db/index.js';

export const healthRoutes = new Hono();

/**
 * Health check endpoint
 * Returns the status of all services
 */
healthRoutes.get('/', async (c) => {
  // Check actual database connectivity
  const dbConnected = await isDatabaseConnected();

  const services = {
    database: dbConnected ? 'connected' : 'disconnected',
    synapse: 'disconnected' as const, // Will be updated in Phase 4
    fvm: 'disconnected' as const, // Will be updated in Phase 5
  } as const;

  // Determine overall health status
  const allHealthy = Object.values(services).every((s) => s === 'connected');
  const anyHealthy = Object.values(services).some((s) => s === 'connected');

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (allHealthy) {
    status = 'healthy';
  } else if (anyHealthy) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return c.json({
    status,
    timestamp: new Date().toISOString(),
    services,
    version: '0.1.0',
    environment: process.env.NODE_ENV ?? 'development',
  });
});

/**
 * Liveness probe for Kubernetes/container orchestration
 */
healthRoutes.get('/live', (c) => {
  return c.json({ status: 'ok' });
});

/**
 * Readiness probe for Kubernetes/container orchestration
 * Checks if the service can accept traffic
 */
healthRoutes.get('/ready', async (c) => {
  // Check database connectivity for readiness
  const dbReady = await isDatabaseConnected();

  if (dbReady) {
    return c.json({ status: 'ready' });
  }

  return c.json({ status: 'not_ready', reason: 'database_unavailable' }, 503);
});
