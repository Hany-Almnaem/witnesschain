/**
 * DID (Decentralized Identifier) Management Module
 * 
 * Implements did:key generation and management using Ed25519 keys.
 * Uses tweetnacl for key generation and manual did:key formatting.
 * 
 * DID Format: did:key:z<base58btc-encoded-public-key>
 * 
 * Security notes:
 * - Private keys are managed via key-storage.ts (never in plaintext)
 * - DIDs are derived from public keys and are safe to share
 * - Each wallet address maps to one DID
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

/**
 * Base58btc alphabet for multibase encoding
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode bytes to base58btc
 */
function encodeBase58(bytes: Uint8Array): string {
  const result: number[] = [];
  
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < result.length; i++) {
      carry += result[i] << 8;
      result[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      result.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  
  // Add leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      result.push(0);
    } else {
      break;
    }
  }
  
  return result
    .reverse()
    .map(i => BASE58_ALPHABET[i])
    .join('');
}

/**
 * Decode base58btc to bytes
 */
function decodeBase58(str: string): Uint8Array {
  const result: number[] = [];
  
  for (const char of str) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error('Invalid base58 character');
    }
    
    let carry = value;
    for (let i = 0; i < result.length; i++) {
      carry += result[i] * 58;
      result[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      result.push(carry & 0xff);
      carry >>= 8;
    }
  }
  
  // Add leading zeros
  for (const char of str) {
    if (char === BASE58_ALPHABET[0]) {
      result.push(0);
    } else {
      break;
    }
  }
  
  return new Uint8Array(result.reverse());
}

/**
 * Ed25519 multicodec prefix (0xed01)
 */
const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

/**
 * DID keypair containing public and secret keys
 */
export interface DIDKeyPair {
  did: string;
  publicKey: string;
  secretKey: Uint8Array;
}

/**
 * Generate a new DID keypair using Ed25519
 * 
 * @returns DID string, public key (base64), and secret key bytes
 */
export async function generateDIDKeyPair(): Promise<DIDKeyPair> {
  // Generate Ed25519 key pair using tweetnacl
  const keyPair = nacl.sign.keyPair();
  
  // Create the multicodec-prefixed public key
  const prefixedPublicKey = new Uint8Array(
    ED25519_MULTICODEC_PREFIX.length + keyPair.publicKey.length
  );
  prefixedPublicKey.set(ED25519_MULTICODEC_PREFIX);
  prefixedPublicKey.set(keyPair.publicKey, ED25519_MULTICODEC_PREFIX.length);
  
  // Encode to base58btc and format as did:key
  // 'z' is the multibase prefix for base58btc
  const did = `did:key:z${encodeBase58(prefixedPublicKey)}`;
  
  // Public key as base64 for storage/transmission
  const publicKey = encodeBase64(keyPair.publicKey);
  
  return {
    did,
    publicKey,
    secretKey: keyPair.secretKey,
  };
}

/**
 * Restore a DID from stored secret key
 * 
 * @param secretKey - The secret key bytes from secure storage
 * @returns The DID string and public key
 */
export async function restoreDIDFromSecretKey(
  secretKey: Uint8Array
): Promise<{ did: string; publicKey: string }> {
  // Extract public key from secret key (last 32 bytes of 64-byte nacl key)
  const publicKeyBytes = secretKey.slice(32, 64);
  
  // Create DID
  const prefixedPublicKey = new Uint8Array(
    ED25519_MULTICODEC_PREFIX.length + publicKeyBytes.length
  );
  prefixedPublicKey.set(ED25519_MULTICODEC_PREFIX);
  prefixedPublicKey.set(publicKeyBytes, ED25519_MULTICODEC_PREFIX.length);
  
  const did = `did:key:z${encodeBase58(prefixedPublicKey)}`;
  const publicKey = encodeBase64(publicKeyBytes);
  
  return { did, publicKey };
}

/**
 * Sign data with a DID private key
 * 
 * @param secretKey - The secret key bytes
 * @param data - Data to sign
 * @returns Base64-encoded signature
 */
export async function signWithDID(
  secretKey: Uint8Array,
  data: Uint8Array
): Promise<string> {
  const signature = nacl.sign.detached(data, secretKey);
  return encodeBase64(signature);
}

/**
 * Verify a signature against a DID
 * 
 * @param did - The DID string
 * @param signature - Base64-encoded signature
 * @param data - Original data that was signed
 * @returns True if signature is valid
 */
export async function verifyDIDSignature(
  did: string,
  signature: string,
  data: Uint8Array
): Promise<boolean> {
  try {
    const publicKey = didToPublicKeyBytes(did);
    const signatureBytes = decodeBase64(signature);
    return nacl.sign.detached.verify(data, signatureBytes, publicKey);
  } catch {
    return false;
  }
}

/**
 * Extract public key bytes from a DID
 */
function didToPublicKeyBytes(did: string): Uint8Array {
  if (!did.startsWith('did:key:z')) {
    throw new Error('Invalid DID format');
  }
  
  // Decode base58btc (remove 'z' prefix)
  const prefixedKey = decodeBase58(did.slice(9));
  
  // Remove multicodec prefix (2 bytes)
  return prefixedKey.slice(2);
}

/**
 * Parse a DID string to extract the public key
 * 
 * @param did - The DID string (did:key:z...)
 * @returns Base64-encoded public key
 */
export function didToPublicKey(did: string): string {
  const publicKeyBytes = didToPublicKeyBytes(did);
  return encodeBase64(publicKeyBytes);
}

/**
 * Validate DID format
 * 
 * @param did - The DID string to validate
 * @returns True if valid did:key format
 */
export function isValidDID(did: string): boolean {
  if (!did || typeof did !== 'string') {
    return false;
  }
  
  // Check for did:key:z prefix (z indicates base58btc multibase encoding)
  if (!did.startsWith('did:key:z')) {
    return false;
  }
  
  try {
    // Try to decode and verify structure
    const publicKey = didToPublicKeyBytes(did);
    return publicKey.length === 32; // Ed25519 public keys are 32 bytes
  } catch {
    return false;
  }
}

/**
 * Generate a deterministic identifier from a DID
 * Useful for creating consistent IDs for storage
 * 
 * @param did - The DID string
 * @returns SHA-256 hash of the DID as hex string
 */
export async function didToIdentifier(did: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(did);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Re-export createLinkingChallenge from shared package
 * This ensures client and server use identical message format
 */
export { createLinkingChallenge } from '@witnesschain/shared';

/**
 * Encryption keypair generation using X25519
 * For file encryption (separate from signing keys)
 */
export function generateEncryptionKeyPair(): {
  publicKey: string;
  secretKey: string;
} {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
}
