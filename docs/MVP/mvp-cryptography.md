# MVP Cryptography

## Overview

WitnessChain encrypts evidence files client-side before upload. The backend and Filecoin storage providers never see plaintext content. Only the evidence owner can decrypt files using their password-protected secret key.

### Threat Model

| Assumption | Trust Level |
|------------|-------------|
| Backend server | Untrusted for content confidentiality |
| Client device | Trusted while unlocked |
| User password | Determines key security |
| Filecoin providers | Store ciphertext only |

## Key Types

### Ed25519 (Signing)

| Property | Value |
|----------|-------|
| Purpose | DID generation, UCAN issuance, message signing |
| Secret key size | 64 bytes (32-byte seed + 32-byte embedded public key) |
| Public key size | 32 bytes |
| Storage | Encrypted in IndexedDB via AES-GCM |
| Never used for | File encryption |

### X25519 (Encryption)

| Property | Value |
|----------|-------|
| Purpose | File encryption key exchange (NaCl box) |
| Secret key size | 32 bytes |
| Public key size | 32 bytes |
| Storage | Derived on-demand from Ed25519 seed |
| Derivation | `nacl.box.keyPair.fromSecretKey(ed25519SecretKey.slice(0, 32))` |

### Why Key Separation Matters

Ed25519 and X25519 are mathematically related but operationally incompatible:
- Ed25519 uses twisted Edwards curve
- X25519 uses Montgomery curve

The 64-byte Ed25519 secret key cannot be passed directly to `nacl.box.open()`.

**If mixed**: Encryption may appear to succeed (producing garbage ciphertext), but decryption will fail with cryptic errors or silent corruption.

## Key Lifecycle

### Generation (First Authentication)

```
1. User connects wallet and creates password
2. nacl.sign.keyPair() generates Ed25519 keypair
3. DID derived from Ed25519 public key (did:key:z6Mk...)
4. 64-byte Ed25519 secretKey encrypted with PBKDF2-derived AES key
5. Encrypted key stored in IndexedDB
6. Cleartext key zeroed immediately
```

### Key Storage Summary

| Location | Data | Security |
|----------|------|----------|
| IndexedDB | Encrypted Ed25519 secretKey, salt, IV | AES-GCM, PBKDF2 100k iterations |
| localStorage | Wallet-to-DID mapping | Public info only |
| sessionStorage | Session metadata (DID, wallet, expiry) | No secrets |

**Never stored**: Plaintext secret keys, passwords, file content, symmetric keys.

### Password-Based Encryption

| Parameter | Value |
|-----------|-------|
| KDF | PBKDF2-SHA256 |
| Iterations | 100,000 |
| Salt | Unique per encryption (random bytes) |
| Derived key | 256-bit AES key |
| Cipher | AES-GCM |
| IV | Unique per encryption (random bytes) |
| Integrity | SHA-256 checksum on encrypted data |

## Upload (Encryption) Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User selects file                                                     │
│    └─► Validate type (magic bytes) and size (127B–200MB)                │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Compute content hash                                                  │
│    └─► SHA-256 of plaintext (for post-decryption verification)          │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Generate symmetric key                                                │
│    └─► nacl.randomBytes(32) — unique per file                           │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. Encrypt file                                                          │
│    └─► nacl.secretbox(plaintext, nonce, symmetricKey)                   │
│    └─► Algorithm: XSalsa20-Poly1305                                     │
│    └─► Nonce: 24 bytes, random, unique                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. Encrypt symmetric key                                                 │
│    └─► Generate ephemeral X25519 keypair                                │
│    └─► nacl.box(symmetricKey, nonce, recipientPubKey, ephemeralSecret)  │
│    └─► Algorithm: X25519 + XSalsa20-Poly1305                            │
├─────────────────────────────────────────────────────────────────────────┤
│ 6. Zero sensitive data                                                   │
│    └─► symmetricKey.fill(0)                                             │
│    └─► ephemeralSecretKey.fill(0)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ 7. Send to backend                                                       │
│    └─► encryptedData, encryptedKey, ephemeralPubKey, nonces, hash       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Backend receives**: Encrypted bytes, encrypted key, ephemeral public key, nonces, content hash, metadata.

**Backend never sees**: Plaintext content, symmetric key, user's X25519 private key.

## Download (Decryption) Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User enters password to unlock keys                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Decrypt Ed25519 secret key                                            │
│    └─► PBKDF2 derives AES key from password + stored salt               │
│    └─► AES-GCM decrypts IndexedDB record                                │
│    └─► Result: 64-byte Ed25519 secretKey                                │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Derive X25519 secret key                                              │
│    └─► getEncryptionSecretKey(ed25519SecretKey)                         │
│    └─► nacl.box.keyPair.fromSecretKey(ed25519SecretKey.slice(0, 32))    │
│    └─► Result: 32-byte X25519 secretKey                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. Fetch encrypted data from backend                                     │
│    └─► encryptedData, encryptedKey, ephemeralPubKey, nonces             │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. Decrypt symmetric key                                                 │
│    └─► nacl.box.open(encryptedKey, nonce, ephemeralPubKey, x25519Secret)│
├─────────────────────────────────────────────────────────────────────────┤
│ 6. Decrypt file                                                          │
│    └─► nacl.secretbox.open(encryptedData, nonce, symmetricKey)          │
├─────────────────────────────────────────────────────────────────────────┤
│ 7. Verify integrity                                                      │
│    └─► Compute SHA-256 of decrypted content                             │
│    └─► Compare with stored contentHash                                  │
│    └─► Reject if mismatch                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ 8. Zero all keys                                                         │
│    └─► ed25519SecretKey.fill(0)                                         │
│    └─► x25519SecretKey.fill(0)                                          │
│    └─► symmetricKey.fill(0)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Security Properties

### Implemented

| Property | Mechanism |
|----------|-----------|
| Key at rest | AES-GCM encryption with password-derived key |
| Key in memory | Immediate zeroing after use (`Uint8Array.fill(0)`) |
| Brute force protection | Rate limiting with exponential backoff (up to 1 hour) |
| Multi-tab coordination | BroadcastChannel API |
| Data integrity | SHA-256 checksums on encrypted data |
| Nonce uniqueness | Random generation per operation |
| Forward secrecy | Ephemeral keypairs for key encryption |

### Server-Side Protections

| Protection | Implementation |
|------------|----------------|
| CSRF | Origin validation + custom headers |
| Replay attacks | Nonce tracking with TTL cleanup |
| Signature verification | Wallet signature on registration |
| Timestamp validation | 5-minute max age for signatures |

## Algorithm Summary

| Operation | Algorithm | Library |
|-----------|-----------|---------|
| File encryption | XSalsa20-Poly1305 | tweetnacl |
| Key encryption | X25519 + XSalsa20-Poly1305 | tweetnacl |
| Signing | Ed25519 | tweetnacl |
| Key derivation | PBKDF2-SHA256 | Web Crypto API |
| Key storage encryption | AES-256-GCM | Web Crypto API |
| Content hash | SHA-256 | Web Crypto API |

### Multi-User Access (MVP Clarification)

In the MVP, evidence is encrypted for **a single recipient only**:
- The evidence owner (uploader)

The symmetric file key is encrypted exactly once using the uploader’s X25519 public key.
No additional recipients are supported in the MVP.

Supporting multiple recipients would require:
- Re-encrypting the same symmetric key for each recipient’s X25519 public key
- Storing multiple encrypted key envelopes per evidence item

This functionality is explicitly out of scope for the MVP and reserved for future phases.


## Extension Patterns (Future Work)

### Sharing

Generate per-recipient X25519 keypairs; re-encrypt symmetric key for each recipient's public key. Original ciphertext remains unchanged.

### Recovery

Derive recovery key from mnemonic; encrypt Ed25519 seed with recovery key; store encrypted backup. Allows key recovery without password.

### Re-encryption

Decrypt with old key, re-encrypt with new key; never persist both simultaneously. Required for key rotation.

### Key Rotation

Not implemented in MVP. Would require re-encrypting all existing evidence symmetric keys with new X25519 keypair.

## Source Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/crypto.ts` | File encryption/decryption |
| `apps/web/src/lib/did.ts` | DID generation, signing, verification |
| `apps/web/src/lib/key-storage.ts` | IndexedDB encryption, rate limiting |

## Invariants

These properties must be preserved in all future development:

1. Secret keys are NEVER stored in plaintext
2. Passwords are converted to Uint8Array and zeroed after use
3. Ed25519 is used ONLY for signing, X25519 ONLY for encryption
4. Client-side encryption occurs BEFORE any network transmission
5. Content hash verification occurs AFTER every decryption
6. Nonces are NEVER reused
7. Symmetric keys are NEVER sent to backend

