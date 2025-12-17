# MVP Scope

## What the MVP Supports

### Authentication

| Feature | Status |
|---------|--------|
| Wallet connection (MetaMask, WalletConnect) | Implemented |
| DID generation from Ed25519 keypair | Implemented |
| Password-protected key storage (IndexedDB) | Implemented |
| Session management with auto-expiry (30 min) | Implemented |
| Wallet-to-DID linking with signed challenge | Implemented |
| Rate-limited password attempts | Implemented |

### Evidence Management

| Feature | Status |
|---------|--------|
| File upload with client-side encryption | Implemented |
| File type validation (magic byte verification) | Implemented |
| File size limits (127B–200MB) | Implemented |
| Metadata input (title, description, category) | Implemented |
| SHA-256 content hash for integrity | Implemented |
| Evidence listing with pagination | Implemented |
| Evidence detail view | Implemented |
| Encrypted download with decryption | Implemented |
| Status tracking (pending → verified) | Implemented |

### Filecoin Storage

| Feature | Status |
|---------|--------|
| Synapse SDK integration | Implemented |
| Paid storage deals | Implemented |
| PieceCID-based retrieval | Implemented |
| Upload progress tracking | Implemented |
| Calibration testnet deployment | Implemented |

### On-Chain Registration

| Feature | Status |
|---------|--------|
| EvidenceRegistry smart contract | Deployed |
| Content hash registration | Implemented |
| PieceCID registration | Implemented |
| Block number/timestamp recording | Implemented |
| Transaction hash recording | Implemented |
| Admin verification flag | Implemented (deployer-only) |

### Access Control

| Feature | Status |
|---------|--------|
| UCAN token generation | Implemented |
| Capability-based authorization | Implemented |
| Issuer/audience binding | Implemented |
| Token expiration | Implemented |
| Signature verification (@ucanto/core) | Implemented |

### UI/Dashboard

| Feature | Status |
|---------|--------|
| Upload page with drag-and-drop | Implemented |
| Evidence list with filtering | Implemented |
| Evidence detail page | Implemented |
| Dashboard metrics (counts, storage used) | Implemented |
| Status badges (color-coded) | Implemented |
| Copy-to-clipboard for CID/txHash | Implemented |
| Filecoin explorer links | Implemented |

## What the MVP Does NOT Support

### Authentication

| Feature | Status |
|---------|--------|
| Multi-device key sync | Not in MVP |
| Password change/rotation | Not in MVP |
| Account recovery (mnemonic/social) | Not in MVP |
| Hardware wallet signing | Not in MVP |
| WebAuthn/passkey support | Not in MVP |

### Evidence Management

| Feature | Status |
|---------|--------|
| Evidence sharing with other users | Not in MVP |
| Evidence deletion/revocation | Not in MVP |
| Batch uploads | Not in MVP |
| Evidence editing/versioning | Not in MVP |
| Full-text search | Not in MVP |
| Evidence categories/tags UI | Not in MVP |

### Storage

| Feature | Status |
|---------|--------|
| Mainnet deployment | Not in MVP |
| Multi-provider redundancy | Not in MVP |
| Deal renewal automation | Not in MVP |
| Storage cost estimation UI | Not in MVP |

### On-Chain

| Feature | Status |
|---------|--------|
| Role-based verification access | Not in MVP |
| User-initiated on-chain registration | Not in MVP |
| Gas estimation UI | Not in MVP |
| Multi-signature verification | Not in MVP |

### Access Control

| Feature | Status |
|---------|--------|
| Delegated access (sharing UCAN) | Not in MVP |
| Revocation | Not in MVP |
| Time-limited access tokens | Not in MVP |
| Organization/group access | Not in MVP |

### Verification

| Feature | Status |
|---------|--------|
| Human validator network | Not in MVP |
| AI-assisted verification | Not in MVP |
| Dispute resolution | Not in MVP |
| Verification reputation | Not in MVP |

### Governance

| Feature | Status |
|---------|--------|
| DAO governance | Not in MVP |
| Token incentives | Not in MVP |
| Community voting | Not in MVP |

## Intended Users

### Primary (MVP)

| User Type | Use Case |
|-----------|----------|
| Developers | Evaluate architecture, integrate with other systems |
| Security auditors | Review cryptographic implementation |
| Grant reviewers | Assess technical completeness |
| Early testers | Validate end-to-end flows on testnet |

### Secondary (Post-MVP)

| User Type | Use Case |
|-----------|----------|
| Human rights documenters | Preserve evidence with cryptographic guarantees |
| Journalists | Secure source material with timestamps |
| Legal professionals | Chain-of-custody documentation |
| NGOs | Institutional evidence management |

## Technical Assumptions

| Assumption | Implication |
|------------|-------------|
| Users have Ethereum-compatible wallets | MetaMask or WalletConnect required |
| Users can manage passwords securely | No recovery without password |
| Browser supports Web Crypto API | Modern browsers only |
| Network access available | No offline mode |
| Calibration testnet available | Depends on Filecoin testnet uptime |

## Known Limitations

### Security

| Limitation | Impact |
|------------|--------|
| PBKDF2 100k iterations (below OWASP 2024 recommendation of 600k) | Lower brute-force resistance |
| No key rotation mechanism | Compromised keys cannot be rotated |
| Deployer-only verification | Centralized trust for verification |
| No audit trail for key access | Cannot detect unauthorized decryption |

### Scalability

| Limitation | Impact |
|------------|--------|
| Single Synapse endpoint | No provider redundancy |
| SQLite database (dev.db) | Not production-ready |
| No caching layer | Direct Filecoin retrieval on every request |
| Single backend wallet for deals | Potential bottleneck |

### Usability

| Limitation | Impact |
|------------|--------|
| No mobile support | Desktop browsers only |
| No progressive web app | No offline capability |
| Password required for every decryption | No session-based key caching |
| No bulk operations | Single-file uploads only |

### Operational

| Limitation | Impact |
|------------|--------|
| Testnet only | No real-value storage |
| No monitoring/alerting | Manual health checks |
| No backup strategy | Single database instance |
| No rate limiting on uploads | Potential abuse vector |

## Future Phases

The following are identified as future work but are explicitly out of scope for this MVP:

### Phase: Mainnet Deployment

- Deploy to Filecoin mainnet
- Production database (PostgreSQL)
- Multi-region backend
- CDN for static assets

### Phase: Sharing and Collaboration

- Delegated UCAN tokens
- Per-recipient key encryption
- Organization accounts
- Access revocation

### Phase: Verification Network

- Human validator integration
- Multi-signature verification
- Reputation system
- Dispute resolution

### Phase: Recovery and Security

- Mnemonic-based recovery
- Key rotation with re-encryption
- Increase PBKDF2 iterations
- Hardware wallet support

### Phase: Scale and Performance

- Deal renewal automation
- Multi-provider redundancy
- Caching layer
- Batch uploads

## Milestone Mapping

| MVP Component | Verifiable Output |
|---------------|-------------------|
| Client-side encryption | Round-trip test: encrypt → upload → retrieve → decrypt → verify hash |
| Filecoin storage | PieceCID returned, data retrievable via Synapse |
| On-chain registration | Transaction hash, block number, evidence queryable from contract |
| Authentication | DID derivation, wallet linking, session management |
| Access control | UCAN issuance and validation |

Each component has corresponding unit tests and can be verified independently.

## Test Coverage

| Package | Test Count | Coverage Area |
|---------|------------|---------------|
| @witnesschain/web | 56 tests | Auth, crypto, DID, key storage, UCAN, evidence UI |
| @witnesschain/api | 42 tests | CID validation, storage errors, storage integration |
| @witnesschain/contracts | 12 tests | EvidenceRegistry functions |

Integration tests require live Calibration testnet access.

