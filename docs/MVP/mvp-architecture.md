# MVP Architecture

## System Overview

WitnessChain MVP consists of three primary layers:

1. **Frontend** (Next.js) — Handles encryption, key management, and user interaction
2. **Backend** (Hono API) — Routes evidence to Filecoin, registers hashes on-chain
3. **Storage** (Filecoin via Synapse SDK) — Stores encrypted evidence with paid deals

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              User Browser                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Wallet Auth  │  │  DID/Keys    │  │  Encryption  │  │    UCAN     │  │
│  │ (wagmi)      │  │  (Ed25519)   │  │  (X25519)    │  │  (ucanto)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                 │                 │                 │         │
│         └─────────────────┴─────────────────┴─────────────────┘         │
│                                    │                                     │
│                           Encrypted Payload                              │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Backend API (Hono)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Auth Middleware ─► Evidence Routes ─► Synapse Client ─► FVM Client     │
│  (DID/Wallet)       (CRUD + upload)    (storage.ts)      (fvm.ts)       │
└──────────────────────────┬──────────────────────────────┬───────────────┘
                           │                              │
                           ▼                              ▼
              ┌────────────────────────┐    ┌─────────────────────────────┐
              │   Filecoin (Synapse)   │    │  EvidenceRegistry Contract  │
              │   Calibration Testnet  │    │  (Calibration Testnet)      │
              │   ─────────────────    │    │  ─────────────────────────  │
              │   PieceCID storage     │    │  Hash + CID registration    │
              │   Paid deals           │    │  Timestamp + verification   │
              └────────────────────────┘    └─────────────────────────────┘
```

## Trust Boundaries

| Zone | Trusts | Does Not Trust |
|------|--------|----------------|
| Browser | User password, local keys | Backend, network |
| Backend | Wallet signatures, UCAN tokens | Plaintext content |
| Filecoin | Ciphertext integrity | Content semantics |
| Smart Contract | Backend wallet for registration | Evidence content |

**Key Principle**: The backend is untrusted for content confidentiality. All encryption occurs client-side before any network transmission.

## Authentication Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│ Connect │────►│ Create/Enter │────►│ Decrypt/Gen  │────►│   Create    │
│ Wallet  │     │   Password   │     │   Ed25519    │     │   Session   │
└─────────┘     └──────────────┘     └──────────────┘     └─────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │  DID Derived │
                                     │  (did:key:)  │
                                     └──────────────┘
```

**New User**: Connect wallet → Create password → Generate Ed25519 keypair → Derive DID → Sign linking message → Register with backend

**Returning User**: Connect wallet → Enter password → Decrypt stored key → Verify → Resume session

## Evidence Upload Flow

```
1. SELECT FILE
   └─► Validate type (magic bytes) and size (127B–200MB)

2. COMPUTE CONTENT HASH
   └─► SHA-256 of plaintext (for integrity verification)

3. GENERATE SYMMETRIC KEY
   └─► nacl.randomBytes(32)

4. ENCRYPT FILE
   └─► nacl.secretbox(plaintext, nonce, symmetricKey)
   └─► Algorithm: XSalsa20-Poly1305

5. ENCRYPT SYMMETRIC KEY
   └─► nacl.box(symmetricKey, nonce, recipientPubKey, ephemeralSecretKey)
   └─► Algorithm: X25519 + XSalsa20-Poly1305

6. SEND TO BACKEND
   └─► Payload: encryptedData, encryptedKey, ephemeralPubKey, nonces, contentHash, metadata

7. BACKEND STORES TO FILECOIN
   └─► Synapse SDK → Paid deal → PieceCID returned

8. BACKEND REGISTERS ON-CHAIN
   └─► EvidenceRegistry.registerEvidence(contentHash, pieceCID, providerAddress)
```

## Evidence Retrieval Flow

```
1. REQUEST EVIDENCE
   └─► GET /api/evidence/:id (authenticated)

2. FETCH FROM FILECOIN
   └─► Synapse SDK retrieves by PieceCID

3. DECRYPT SYMMETRIC KEY
   └─► Derive X25519 from Ed25519 seed
   └─► nacl.box.open(encryptedKey, nonce, ephemeralPubKey, x25519SecretKey)

4. DECRYPT FILE
   └─► nacl.secretbox.open(encryptedData, nonce, symmetricKey)

5. VERIFY INTEGRITY
   └─► Compare SHA-256(decrypted) with stored contentHash

6. DELIVER TO USER
   └─► Browser download (decrypted content never sent to backend)
```

## Backend Components

### Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/evidence` | POST | Required | Upload encrypted evidence |
| `/api/evidence` | GET | Required | List user's evidence |
| `/api/evidence/:id` | GET | Required | Get evidence metadata |
| `/api/evidence/:id/download` | GET | Required | Retrieve encrypted bytes |
| `/api/evidence/:id/status` | GET | Required | Poll upload status |
| `/api/users/register` | POST | Wallet signature | Create user account |
| `/api/users/me` | GET | Required | Get current user |
| `/api/health/storage` | GET | None | Storage wallet diagnostics |

### Middleware

| Middleware | Function |
|------------|----------|
| `csrf.ts` | Origin validation, custom header requirement |
| `auth.ts` | DID/wallet header validation, signature verification |
| `error.ts` | Consistent error response formatting |

### Storage Layer (`storage.ts`)

- `uploadToFilecoin(data, options)` — Uploads encrypted bytes, returns PieceCID
- `retrieveFromFilecoin(pieceCID)` — Retrieves encrypted bytes
- Progress callbacks for UI feedback

### FVM Integration (`fvm.ts`)

- `registerEvidence(contentHash, pieceCID, provider)` — On-chain registration
- `getEvidence(contentHash)` — Retrieve on-chain record
- `verifyEvidence(contentHash)` — Admin-only verification flag

## Frontend Components

### Key Files

```
apps/web/src/
├── lib/
│   ├── auth.ts           # Session management
│   ├── crypto.ts         # File encryption/decryption
│   ├── did.ts            # DID generation, signing
│   ├── key-storage.ts    # IndexedDB encryption
│   ├── api.ts            # Authenticated fetch wrapper
│   └── wagmi.ts          # Wallet configuration
├── stores/
│   └── auth-store.ts     # Zustand state management
├── components/
│   ├── auth/             # Wallet connect, password prompt
│   └── evidence/         # Upload form, list items
└── app/
    └── (dashboard)/      # Protected routes
```

### State Management

Zustand store maintains:
- Wallet connection state
- Session (DID, wallet address, expiry)
- Authentication status
- Key availability flags

## Smart Contract

**EvidenceRegistry** (`0xF55174886848424b196Af47e6f0C92fABC7A500B` on Calibration)

| Function | Access | Purpose |
|----------|--------|---------|
| `registerEvidence(contentHash, pieceCID, provider)` | Public | Create evidence record |
| `getEvidence(contentHash)` | Public | Read evidence record |
| `verifyEvidence(contentHash)` | Deployer only | Set verification flag |

**Events**:
- `EvidenceRegistered(contentHash, pieceCID, provider, timestamp)`
- `EvidenceVerified(contentHash, verifier, timestamp)`

**MVP Limitation**: Only the deployer wallet can call `verifyEvidence()`. Role-based access is out of scope.

## What the Backend Cannot See

| Data | Visible to Backend |
|------|--------------------|
| Plaintext file content | No |
| Symmetric encryption key | No |
| User's Ed25519 secret key | No |
| User's X25519 secret key | No |
| User's password | No |
| Encrypted ciphertext | Yes |
| Encrypted symmetric key | Yes |
| Content hash | Yes |
| Metadata (title, category) | Yes |
| PieceCID | Yes |

## What Filecoin Guarantees

| Guarantee | Provided |
|-----------|----------|
| Data availability | Yes (paid deal duration) |
| Content integrity | Yes (CID-based addressing) |
| Content confidentiality | No (ciphertext is opaque to Filecoin) |
| Immutable timestamp | Yes (deal start time) |
| Proof of storage | Yes (storage proofs) |

Confidentiality is provided by client-side encryption, not Filecoin.

## Database Schema

| Table | Key Fields |
|-------|------------|
| `users` | id, did, walletAddress, createdAt |
| `evidence` | id, userId, contentHash, pieceCID, status, metadata, encryptionInfo, txHash, blockNumber |

Status progression: `pending` → `uploading` → `stored` → `timestamped` → `verified`

