import { Hono } from 'hono';

import { isDatabaseConnected } from '../db/index.js';
import { isFvmConnected, isContractAvailable, getFvmInfo } from '../lib/fvm.js';
import { isSynapseConnected, getStorageInfo } from '../lib/synapse.js';

export const healthRoutes = new Hono();

/**
 * Health check endpoint
 * Returns the status of all services
 */
healthRoutes.get('/', async (c) => {
  // Check actual service connectivity
  const [dbConnected, synapseConnected, fvmConnected] = await Promise.all([
    isDatabaseConnected(),
    isSynapseConnected(),
    isContractAvailable(),
  ]);

  const services = {
    database: dbConnected ? 'connected' : 'disconnected',
    synapse: synapseConnected ? 'connected' : 'disconnected',
    fvm: fvmConnected ? 'connected' : 'disconnected',
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

/**
 * Storage service status
 * Returns detailed information about Filecoin storage configuration
 */
healthRoutes.get('/storage', async (c) => {
  const [connected, info] = await Promise.all([
    isSynapseConnected(),
    getStorageInfo(),
  ]);

  return c.json({
    status: connected ? 'connected' : 'disconnected',
    network: info?.network ?? 'unknown',
    walletAddress: info?.walletAddress ?? null,
    balance: info?.balance ?? null,
    configured: info?.walletAddress !== null,
  });
});

/**
 * FVM (Filecoin Virtual Machine) status
 * Returns detailed information about the EvidenceRegistry contract
 */
healthRoutes.get('/fvm', async (c) => {
  const [connected, contractAvailable, info] = await Promise.all([
    isFvmConnected(),
    isContractAvailable(),
    getFvmInfo(),
  ]);

  return c.json({
    status: contractAvailable ? 'connected' : connected ? 'network_only' : 'disconnected',
    network: info.network,
    chainId: info.chainId,
    contractAddress: info.contractAddress,
    walletAddress: info.walletAddress,
    balance: info.balance,
    contractConfigured: info.contractAddress !== null,
    walletConfigured: info.walletAddress !== null,
  });
});
