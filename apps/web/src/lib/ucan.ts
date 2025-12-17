/**
 * UCAN Access Control Module
 *
 * Implements User Controlled Authorization Networks (UCAN) for
 * capability-based access control on evidence uploads and reads.
 *
 * Scope: Limited to capability checks for upload/read operations.
 * Not a generalized policy framework.
 *
 * UCAN Structure:
 * - Issuer: The DID granting the capability
 * - Audience: The DID receiving the capability
 * - Capabilities: What actions are permitted
 * - Expiration: When the capability expires
 */

import * as ed25519 from '@ucanto/principal/ed25519';
import { delegate, Delegation } from '@ucanto/core';

/**
 * WitnessChain capability namespaces
 */
export const CAPABILITY_NAMESPACE = 'witnesschain';

/**
 * Supported capability actions
 */
export const CAPABILITIES = {
  /** Upload new evidence */
  EVIDENCE_UPLOAD: `${CAPABILITY_NAMESPACE}/evidence/upload`,
  /** Read/download evidence */
  EVIDENCE_READ: `${CAPABILITY_NAMESPACE}/evidence/read`,
  /** List own evidence */
  EVIDENCE_LIST: `${CAPABILITY_NAMESPACE}/evidence/list`,
  /** Delete own evidence */
  EVIDENCE_DELETE: `${CAPABILITY_NAMESPACE}/evidence/delete`,
} as const;

export type CapabilityAction = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/**
 * Default capability expiration (24 hours)
 */
export const DEFAULT_EXPIRATION_SECONDS = 24 * 60 * 60;

/**
 * UCAN delegation result
 */
export interface UCANDelegation {
  /** Serialized UCAN token */
  token: string;
  /** CID of the delegation */
  cid: string;
  /** Issuer DID */
  issuer: string;
  /** Audience DID */
  audience: string;
  /** Granted capabilities */
  capabilities: string[];
  /** Expiration timestamp (seconds since epoch) */
  expiration: number;
  /** Creation timestamp (seconds since epoch) */
  notBefore?: number;
}

/**
 * Capability check result
 */
export interface CapabilityCheckResult {
  /** Whether the capability is granted */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** The UCAN token if allowed */
  token?: string;
  /** Issuer DID (if allowed) */
  issuer?: string;
  /** Audience DID (if allowed) */
  audience?: string;
}

/**
 * Signer type from ed25519
 */
type Ed25519Signer = Awaited<ReturnType<typeof ed25519.Signer.derive>>;

/**
 * Create a UCAN signer from Ed25519 secret key
 * The secret key should be the full 64-byte nacl signing key
 */
export async function createSignerFromSecretKey(
  secretKey: Uint8Array
): Promise<Ed25519Signer> {
  // Extract the seed (first 32 bytes) from the nacl secret key
  const seed = secretKey.slice(0, 32);

  // Create Ed25519 signer from seed
  const signer = await ed25519.Signer.derive(seed);

  return signer;
}

/**
 * Create a UCAN principal (verifier) from a DID string
 */
export function createPrincipalFromDID(did: `did:key:${string}`) {
  return ed25519.Verifier.parse(did);
}

/**
 * Issue a self-signed capability for own resources
 * Used when a user needs to prove they have access to their own evidence
 */
export async function issueSelfCapability(
  signer: Ed25519Signer,
  capability: CapabilityAction,
  resourceId?: string,
  expirationSeconds: number = DEFAULT_EXPIRATION_SECONDS
): Promise<UCANDelegation> {
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + expirationSeconds;

  // Resource is either a specific evidence ID or wildcard for user's resources
  const resource = resourceId
    ? `${signer.did()}:evidence/${resourceId}`
    : `${signer.did()}:evidence/*`;

  // Create the capability definition with proper type
  const cap = {
    can: capability,
    with: resource as `${string}:${string}`,
  };

  // Create delegation (self-issued - issuer and audience are the same)
  const delegation = await delegate({
    issuer: signer,
    audience: signer, // Self-delegation
    capabilities: [cap],
    expiration,
    notBefore: now,
  });

  // Archive to get the CID and serialized form
  const archive = await delegation.archive();

  if (archive.error) {
    throw new UCANError(
      'UCAN_DELEGATION_FAILED',
      `Failed to create capability: ${archive.error.message}`
    );
  }

  // Encode as base64 for transport
  const token = uint8ArrayToBase64(archive.ok);

  return {
    token,
    cid: delegation.cid.toString(),
    issuer: signer.did(),
    audience: signer.did(),
    capabilities: [capability],
    expiration,
    notBefore: now,
  };
}

/**
 * Delegate a capability to another DID
 * Used for sharing evidence access with others
 */
export async function delegateCapability(
  signer: Ed25519Signer,
  audienceDid: `did:key:${string}`,
  capability: CapabilityAction,
  resourceId: string,
  expirationSeconds: number = DEFAULT_EXPIRATION_SECONDS
): Promise<UCANDelegation> {
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + expirationSeconds;

  const audience = createPrincipalFromDID(audienceDid);

  // Resource must be specific when delegating to others
  const resource = `${signer.did()}:evidence/${resourceId}`;

  const cap = {
    can: capability,
    with: resource as `${string}:${string}`,
  };

  const delegation = await delegate({
    issuer: signer,
    audience,
    capabilities: [cap],
    expiration,
    notBefore: now,
  });

  const archive = await delegation.archive();

  if (archive.error) {
    throw new UCANError(
      'UCAN_DELEGATION_FAILED',
      `Failed to delegate capability: ${archive.error.message}`
    );
  }

  const token = uint8ArrayToBase64(archive.ok);

  return {
    token,
    cid: delegation.cid.toString(),
    issuer: signer.did(),
    audience: audienceDid,
    capabilities: [capability],
    expiration,
    notBefore: now,
  };
}

/**
 * Parse a UCAN token to extract its claims
 * 
 * NOTE: Delegation.extract() performs cryptographic signature verification.
 * This function will throw if the token is malformed or has an invalid signature.
 */
export async function parseUCANToken(token: string): Promise<{
  issuer: string;
  audience: string;
  capabilities: Array<{ can: string; with: string }>;
  expiration: number;
  notBefore?: number;
}> {
  const bytes = base64ToUint8Array(token);

  // Delegation.extract performs signature verification as part of extraction
  // It will fail if the token signature is invalid
  const result = await Delegation.extract(bytes);

  if (result.error) {
    throw new UCANError('UCAN_PARSE_FAILED', 'Failed to parse or verify UCAN token');
  }

  const delegation = result.ok;

  return {
    issuer: delegation.issuer.did(),
    audience: delegation.audience.did(),
    capabilities: delegation.capabilities.map((cap) => ({
      can: String(cap.can),
      with: String(cap.with),
    })),
    expiration: delegation.expiration ?? 0,
    notBefore: delegation.notBefore,
  };
}

/**
 * Check if a UCAN token grants a specific capability
 * 
 * Performs the following checks:
 * 1. Token signature (via parseUCANToken -> Delegation.extract)
 * 2. Expiration (required - missing expiration = expired)
 * 3. notBefore (if present)
 * 4. Capability action matches required action
 * 5. Resource matches (if resourceId provided)
 * 
 * @param token - UCAN token (base64)
 * @param requiredCapability - The capability action required
 * @param resourceId - Optional specific resource ID
 * @param requesterDid - Optional requester DID for audience binding check
 */
export async function checkCapability(
  token: string,
  requiredCapability: CapabilityAction,
  resourceId?: string,
  requesterDid?: string
): Promise<CapabilityCheckResult> {
  try {
    const claims = await parseUCANToken(token);

    const now = Math.floor(Date.now() / 1000);

    // Check expiration - REQUIRED (missing = expired for security)
    if (!claims.expiration || claims.expiration === 0) {
      return {
        allowed: false,
        reason: 'Capability has no expiration (required for security)',
      };
    }

    if (claims.expiration < now) {
      return {
        allowed: false,
        reason: 'Capability has expired',
      };
    }

    // Check notBefore
    if (claims.notBefore && claims.notBefore > now) {
      return {
        allowed: false,
        reason: 'Capability is not yet valid',
      };
    }

    // Check audience binding (if requester DID provided)
    // The requester should be either the audience or the issuer (for self-issued)
    if (requesterDid) {
      const isAudience = claims.audience === requesterDid;
      const isSelfIssued = claims.issuer === claims.audience && claims.issuer === requesterDid;
      
      if (!isAudience && !isSelfIssued) {
        return {
          allowed: false,
          reason: 'Capability not issued to this requester',
        };
      }
    }

    // Check if required capability is granted
    const hasCapability = claims.capabilities.some((cap) => {
      // Check action matches
      if (cap.can !== requiredCapability) {
        return false;
      }

      // Check resource matches
      if (resourceId) {
        // Resource must match exactly or be a wildcard
        const isExact = cap.with.endsWith(`:evidence/${resourceId}`);
        const isWildcard = cap.with.endsWith(':evidence/*');
        return isExact || isWildcard;
      }

      return true;
    });

    if (!hasCapability) {
      return {
        allowed: false,
        reason: `Required capability "${requiredCapability}" not granted`,
      };
    }

    return {
      allowed: true,
      token,
      issuer: claims.issuer,
      audience: claims.audience,
    };
  } catch (error) {
    return {
      allowed: false,
      reason:
        error instanceof Error ? error.message : 'Failed to verify capability',
    };
  }
}

/**
 * Create an upload capability for evidence submission
 * Convenience function for common operation
 */
export async function createUploadCapability(
  signer: Ed25519Signer,
  expirationSeconds: number = 3600 // 1 hour default for uploads
): Promise<UCANDelegation> {
  return issueSelfCapability(
    signer,
    CAPABILITIES.EVIDENCE_UPLOAD,
    undefined,
    expirationSeconds
  );
}

/**
 * Create a read capability for evidence retrieval
 * Convenience function for common operation
 */
export async function createReadCapability(
  signer: Ed25519Signer,
  evidenceId: string,
  expirationSeconds: number = DEFAULT_EXPIRATION_SECONDS
): Promise<UCANDelegation> {
  return issueSelfCapability(
    signer,
    CAPABILITIES.EVIDENCE_READ,
    evidenceId,
    expirationSeconds
  );
}

/**
 * Check if user can upload evidence
 */
export async function canUploadEvidence(token: string): Promise<boolean> {
  const result = await checkCapability(token, CAPABILITIES.EVIDENCE_UPLOAD);
  return result.allowed;
}

/**
 * Check if user can read specific evidence
 */
export async function canReadEvidence(
  token: string,
  evidenceId: string
): Promise<boolean> {
  const result = await checkCapability(
    token,
    CAPABILITIES.EVIDENCE_READ,
    evidenceId
  );
  return result.allowed;
}

/**
 * UCAN error class
 */
export class UCANError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'UCANError';
  }
}

/**
 * UCAN error codes
 */
export const UCAN_ERROR_CODES = {
  UCAN_DELEGATION_FAILED: 'Failed to create UCAN delegation',
  UCAN_PARSE_FAILED: 'Failed to parse UCAN token',
  UCAN_VERIFICATION_FAILED: 'Failed to verify UCAN token',
  UCAN_EXPIRED: 'UCAN token has expired',
  UCAN_NOT_YET_VALID: 'UCAN token is not yet valid',
  UCAN_CAPABILITY_DENIED: 'Required capability not granted',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
