/**
 * Environment configuration for the API server
 * Uses shared package for schema validation
 */

import { loadBackendEnv, type BackendEnv } from '@witnesschain/shared';

let _env: BackendEnv | null = null;

/**
 * Get validated environment configuration
 */
export function getEnv(): BackendEnv {
  if (_env) {
    return _env;
  }

  _env = loadBackendEnv();
  return _env;
}

/**
 * Initialize and validate environment at startup
 */
export function initEnv(): void {
  const env = getEnv();

  console.info('[Config] Environment validated successfully');
  console.info(`[Config] Network: ${env.FILECOIN_NETWORK}`);
  console.info(`[Config] Database: ${env.DATABASE_URL.startsWith('file:') ? 'SQLite' : 'Turso'}`);

  if (!env.BACKEND_PRIVATE_KEY) {
    console.warn('[Config] ⚠️ BACKEND_PRIVATE_KEY not set - storage payments will fail');
  }

  if (!env.EVIDENCE_REGISTRY_ADDRESS) {
    console.warn('[Config] ⚠️ EVIDENCE_REGISTRY_ADDRESS not set - on-chain features disabled');
  }
}

// Re-export type for convenience
export type { BackendEnv };
