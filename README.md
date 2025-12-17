# WitnessChain

WitnessChain is a decentralized evidence preservation system designed to safeguard and authenticate human rights documentation in politically unstable and high-risk environments.

The platform enables individuals and organizations to securely capture, encrypt, timestamp, and retrieve digital evidence—such as videos, photos, audio recordings, and documents—while maintaining cryptographic guarantees of integrity, confidentiality, and provenance.

All evidence is encrypted client-side before transmission, ensuring that neither the backend nor storage providers (including Filecoin) can access plaintext content. Cryptographic timestamps and on-chain registration provide tamper-resistance and verifiable proof of existence, forming a foundation for future multi-layer verification processes.

This repository contains the MVP implementation, focused on secure evidence preservation and verifiable storage. Advanced verification workflows, validator networks, and AI-assisted analysis are intentionally out of scope at this stage and planned for future phases.

**This is an MVP implementation, not a full protocol.**

## Core Implemented Features

- **Wallet-Based Authentication**: MetaMask/WalletConnect integration with DID generation (Ed25519)
- **Client-Side Encryption**: Files encrypted in-browser using XSalsa20-Poly1305 before upload
- **Password-Protected Keys**: User secret keys encrypted at rest with PBKDF2 + AES-GCM
- **Filecoin Storage**: Paid deals via Synapse SDK on Calibration testnet
- **On-Chain Timestamping**: Evidence hashes registered to EvidenceRegistry smart contract
- **UCAN Access Control**: Capability-based authorization for upload/read operations
- **Evidence Management UI**: Upload, list, detail view, and encrypted download

## Filecoin Integration Summary

| Component | Implementation |
|-----------|----------------|
| SDK | @filoz/synapse-sdk |
| Network | Filecoin Calibration Testnet |
| Deal Type | Paid storage deals |
| Identifier | PieceCID returned on upload |
| Contract | EvidenceRegistry at `0xF55174886848424b196Af47e6f0C92fABC7A500B` |

The backend wallet funds storage deals. Users do not pay gas directly for storage—only the on-chain registration requires a transaction from the backend wallet.

Note: Filecoin provides availability and integrity guarantees.
Confidentiality is achieved exclusively via client-side encryption.


## Security Model (Client-Side Encryption)

```
User Browser                          Backend                    Filecoin
     │                                    │                          │
     ├─ Generate symmetric key            │                          │
     ├─ Encrypt file (XSalsa20-Poly1305)  │                          │
     ├─ Encrypt key (X25519 box)          │                          │
     ├─ Compute SHA-256 hash              │                          │
     │                                    │                          │
     ├──── Send encrypted data ──────────►│                          │
     │     (ciphertext only)              ├──── Store ciphertext ───►│
     │                                    │                          │
     │                                    ├──── Register hash ──────►│ (on-chain)
     │                                    │                          │
```

**Backend never sees**: Plaintext content, symmetric keys, user private keys.

**Filecoin stores**: Encrypted bytes only.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

See [docs/SETUP.md](docs/POC/SETUP.md) for full environment configuration.

## Project Structure

```
apps/
├── api/          # Hono backend (evidence routes, auth middleware)
├── web/          # Next.js frontend (dashboard, upload, evidence views)
packages/
├── contracts/    # EvidenceRegistry Solidity contract
├── shared/       # Types, validation, constants
```

## Documentation

- [MVP Architecture](docs/MVP/mvp-architecture.md)
- [MVP Cryptography](docs/MVP/mvp-cryptography.md)
- [MVP Scope](docs/MVP/mvp-scope.md)

## License

MIT
