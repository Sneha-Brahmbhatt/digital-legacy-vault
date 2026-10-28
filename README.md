# Digital Legacy Vault

> **Zero-Knowledge Encrypted Legacy Management & Multi-Party Release Engine**  
> Built for GSFC University BTCS502 — Software Engineering Project  
> **Student**: Sneha Brahmbhatt (24BT04011) | **Stack**: JavaScript (ES Modules), React + Vite, Node.js + Express, MongoDB + Mongoose

[![Vitest Tests](https://img.shields.io/badge/Vitest-57%20Passed-brightgreen)](https://github.com/Sneha-Brahmbhatt/digital-legacy-vault)
[![Zero Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge%20Client--Side%20AES--256-blue)](https://github.com/Sneha-Brahmbhatt/digital-legacy-vault)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 📌 Executive Summary & Architecture Overview

**Digital Legacy Vault** is an end-to-end secure web application allowing users to preserve credentials, sensitive legal documents, and private messages. Assets are encrypted entirely on the client before network transit and can be gracefully released to designated trustees following verified triggers.

### Architectural Highlights
1. **Zero-Knowledge Cryptography**: Raw data encryption keys (DEKs) and plaintext data never touch the backend server. All encryption and key wrapping occur in the browser via the W3C Web Crypto API.
2. **Canonical Release Workflow**: Discards legacy dead-man inactivity timers in favor of the requirement-specified active workflow:
   - **Trustee-Initiated** $\rightarrow$ **Cryptographic OTP Verification Challenge** $\rightarrow$ **Pending Grace Period Window** $\rightarrow$ **Real-Time Owner Alert & Veto Control** $\rightarrow$ **Deterministic Grace Period Expiry Auto-Release**.
3. **Defense-in-Depth (NFR-2)**: No single actor can force premature or unauthorized release. Trustee action is met with mandatory out-of-band identity verification and an immutable owner grace period cancellation window.

---

## 🔐 Cryptographic Architecture

```
[ Client Browser ]                                            [ Node.js Server & MongoDB ]
===========================================================================================
1. Registration:
   generateKey('RSA-OAEP', 2048) 
   deriveKey(Password, Salt, PBKDF2 100k iter)
   encrypt(PrivateKey, derivedKey, AES-GCM) ───────> Stores: publicKey, encryptedPrivateKey,
                                                             privateKeyIv, privateKeySalt

2. Vault Item Encryption:
   generateKey('AES-GCM', 256) [DEK]
   encrypt(ItemContent, DEK, AES-GCM)
   wrapKey(DEK, OwnerPublicKey, RSA-OAEP) ─────────> Stores: encryptedContent, contentIv,
                                                             encryptedKeyForOwner

3. Trustee Key Delegation:
   unwrapKey(encryptedKeyForOwner, OwnerPrivateKey)
   wrapKey(DEK, TrusteePublicKey, RSA-OAEP) ───────> Stores: encryptedKeyForTrustee in
                                                             TrusteeAssignment record
```

- **Symmetric Cipher**: `AES-256-GCM` with cryptographically random 96-bit initialization vectors (IVs) generated per encryption operation (`crypto.getRandomValues`). Nonce reuse is structurally eliminated.
- **Asymmetric Cipher**: `RSA-OAEP` (2048-bit modulus, SHA-256 hash) used for envelope encryption of symmetric Data Encryption Keys (DEKs).
- **Key Derivation Function (KDF)**: `PBKDF2` with SHA-256 and **100,000 iterations** to derive master key protection from master account passwords.

---

## 🔄 The Canonical Release Workflow

```
               [ Trustee initiates request ]
                            │
                            ▼
          [ System issues 6-digit challenge OTP ]
                            │
               [ Trustee verifies OTP ]
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ Status: PENDING (Grace Period active) │
        │ Owner notified via email immediately  │
        └───────────────────┬───────────────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
    [ Owner cancels request ]     [ Grace period expires ]
             │                             │
             ▼                             ▼
    Status: CANCELLED             Status: RELEASED
   (Keys remain sealed)          (Trustee fetches wrapped DEK)
```

1. **Initiation**: An authorized trustee initiates a claim on the owner's vault.
2. **Identity Verification**: System generates a cryptographically random, uniform 6-digit OTP stored as a bcrypt hash. Trustee must provide the matching OTP to advance.
3. **Grace Period**: Status shifts to `pending`. A configurable grace period (default **48 hours**, configurable via `GRACE_PERIOD_TEST_MINUTES` for testing) commences.
4. **Immediate Alert & Veto**: Owner receives a real-time notification with a direct cancellation link. During this entire window, the owner can cancel with one click.
5. **Auto-Release Worker**: Background polling job (`releaseExpiryWorker.js`) detects expired pending requests and performs an atomic state transition to `released`.
6. **Handover**: The trustee can now fetch the delegated items; their browser unwraps the DEKs with their private key unlocked in memory.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 18 + Vite | Modular UI with JSX, React Router v6 |
| **Styling** | Bootstrap 5 + Custom CSS | Cyberpunk/Obsidian vault theme with reactive dashboards |
| **Cryptography** | Browser Web Crypto API | Native hardware-accelerated AES-GCM and RSA-OAEP |
| **Backend** | Node.js + Express (ES Modules) | Strict REST API with helmet, CORS, and express-rate-limit |
| **Database** | MongoDB + Mongoose | Enforced schemas, composite indices, validation rules |
| **Testing** | Vitest + Supertest | 57 automated unit and integration tests |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Local MongoDB or MongoDB Atlas connection URI

### 1. Repository Setup
```bash
git clone https://github.com/Sneha-Brahmbhatt/digital-legacy-vault.git
cd digital-legacy-vault
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/digital_legacy_vault

# Authentication Secrets
JWT_SECRET=your_ultra_secure_jwt_access_secret_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_ultra_secure_jwt_refresh_secret_min_32_chars
JWT_REFRESH_EXPIRES_IN=7d

# Release Workflow Configuration
DEFAULT_GRACE_PERIOD_HOURS=48
GRACE_PERIOD_TEST_MINUTES=5

# Optional: Real Email Notifications (Resend)
RESEND_API_KEY=
FROM_EMAIL=vault-notifications@digitallegacyvault.local
```

### 3. Installation & Running

#### Server
```bash
cd server
npm install
npm run dev
```

#### Client
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Test Suite

Run the full suite of unit and security tests:
```bash
cd server
npm test
```

### Test Coverage Highlights:
- **`tests/auth.test.js`**: Registration, bcrypt hashing verification, login, rate-limiting, constant-time error responses, token refresh rotation, and logout session revocation.
- **`tests/vault.test.js`**: Zero-knowledge ciphertext storage, 403 authorization isolation between separate user accounts, category filtering, document upload size limits.
- **`tests/trustee.test.js`**: Trustee designation, self-assignment prevention, cross-owner item permission authorization, and cryptographic key unlinking upon revocation.
- **`tests/release.test.js`**: Complete release engine state machine, OTP verification challenge, duplicate request rejection, atomic owner cancellation, and background auto-release.

---

## 🛡️ Security Audit Log

Every security-sensitive event is automatically written to an immutable, append-only `AuditLog` collection:
- `AUTH_REGISTER`, `AUTH_LOGIN`, `AUTH_LOGOUT`
- `VAULT_ITEM_CREATE`, `VAULT_ITEM_UPDATE`, `VAULT_ITEM_DELETE`
- `TRUSTEE_ASSIGNED`, `TRUSTEE_PERMISSIONS_UPDATED`, `TRUSTEE_REVOKED`
- `RELEASE_INITIATED`, `RELEASE_OTP_VERIFIED`, `RELEASE_CANCELLED_BY_OWNER`, `RELEASE_AUTO_EXECUTED`
- `UNAUTHORIZED_ACCESS_ATTEMPT`

Accessible directly from the frontend via the `/audit` dashboard.
