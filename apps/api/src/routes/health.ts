import { Hono } from 'hono';

export const healthRoutes = new Hono();

/**
 * Health check endpoint
 * Returns the status of all services
 */
healthRoutes.get('/', async (c) => {
  const services = {
    database: 'connected' as const,
    synapse: 'disconnected' as const, // Will be updated in Phase 4
    fvm: 'disconnected' as const, // Will be updated in Phase 5
  };

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
 */
healthRoutes.get('/ready', async (c) => {
  // TODO: Check database connection in Phase 1.5
  const ready = true;

  if (ready) {
    return c.json({ status: 'ready' });
  }

  return c.json({ status: 'not_ready' }, 503);
});
