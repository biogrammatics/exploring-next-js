# Data Security Architecture

This document outlines the security architecture for user data protection in the BioGrammatics codon optimization service.

## Overview

Users can choose between two data storage modes:

1. **Standard Storage** (default) - Data stored as plaintext, accessible to administrators
2. **Encrypted Storage** (opt-in) - Data encrypted at rest with user-controlled password

## Standard Storage (Default)

- Protein sequences and DNA results stored in database as plaintext
- Protected by standard database security (TLS in transit, access controls)
- Administrators can access data for support/debugging purposes
- Covered by privacy policy

**Protects against:** Unauthorized external access, network interception

**Does not protect against:** Database breaches, malicious insiders, subpoenas

## Encrypted Storage (Opt-in)

Users who require additional privacy can enable client-side encryption.

### How It Works

#### Key Derivation
- User creates an encryption password (separate from login)
- Password is processed client-side using PBKDF2 with 100,000 iterations
- A random salt is generated and stored on server
- A verification hash is created to confirm correct password entry
- **The password and derived key are never sent to or stored on the server**

#### Encryption Process
1. User submits protein sequence (plaintext over HTTPS)
2. Server/worker processes the optimization (plaintext in memory)
3. Worker returns DNA result to client
4. Client encrypts both protein and DNA sequences using AES-256-GCM
5. Client sends encrypted blobs to server for storage
6. Server stores only encrypted data

#### Decryption Process
1. User requests saved job
2. Server returns encrypted blobs
3. User enters encryption password
4. Client derives key and decrypts data locally

### What's Stored on Server

| Field | Standard Mode | Encrypted Mode |
|-------|--------------|----------------|
| Protein sequence | Plaintext | Encrypted blob |
| Protein name | Plaintext | Encrypted blob |
| DNA sequence | Plaintext | Encrypted blob |
| Encryption salt | N/A | Random bytes |
| Verification hash | N/A | Hash for password verification |
| Encryption IV | N/A | Unique per job |

### What's NEVER Stored

- User's encryption password
- Derived encryption key

### Security Properties

**Protects against:**
- Database breaches (attacker gets encrypted blobs, useless without password)
- Malicious administrators browsing data
- Stolen database backups
- Subpoenas (company cannot decrypt user data)

**Does not protect against:**
- Compromised client JavaScript (could steal password when entered)
- Keyloggers on user's machine
- Weak user passwords
- Data in transit during processing (briefly plaintext in server memory)

### Limitations

1. **Unrecoverable data**: If user forgets password, data cannot be recovered. This is intentional - it's what makes the encryption meaningful.

2. **Brief plaintext window**: Between worker completion and client encryption, data exists as plaintext in the database briefly (typically < 1 second with aggressive polling).

3. **Processing requires plaintext**: The optimization algorithm runs on plaintext sequences. True end-to-end encryption is not possible if the server does the processing.

## Schema Design

```prisma
model User {
  // Existing fields...

  // Encryption settings (null = not using encryption)
  encryptionSalt       String?   // Random salt for key derivation
  encryptionVerifier   String?   // Hash to verify correct password
  encryptionEnabledAt  DateTime? // When encryption was enabled
}

model CodonOptimizationJob {
  // Existing fields...

  isEncrypted      Boolean  @default(false)
  encryptionIV     String?  // Initialization vector, unique per job

  // These store either plaintext OR encrypted data based on isEncrypted flag
  proteinSequence  String   @db.Text
  proteinName      String?
  dnaSequence      String?  @db.Text
}
```

## Implementation Components

### Client-Side Encryption Library

Location: `src/lib/encryption.ts`

- `deriveKey(password, salt)` - PBKDF2 key derivation
- `generateSalt()` - Random salt generation
- `generateIV()` - Random IV for each encryption
- `createVerifier(key, salt)` - Create verification hash
- `verifyPassword(key, salt, verifier)` - Check password is correct
- `encrypt(data, key)` - AES-256-GCM encryption
- `decrypt(ciphertext, iv, key)` - AES-256-GCM decryption

Uses Web Crypto API (available in all modern browsers).

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/account/enable-encryption` | Store salt and verifier |
| `POST /api/account/disable-encryption` | Remove encryption (requires re-saving all jobs as plaintext) |
| `POST /api/account/change-encryption-password` | Update salt/verifier (requires client-side re-encryption) |
| `POST /api/codon-optimization/[id]/encrypt` | Replace plaintext with encrypted data after job completion |

### User Flows

#### Enabling Encryption

1. User navigates to Account Settings
2. Selects "Encrypted Storage"
3. Enters and confirms encryption password
4. Client generates salt, derives key, creates verifier
5. Client sends salt + verifier to server (never the password)
6. Existing jobs remain unencrypted (or offer migration)

#### Submitting a Job (Encrypted User)

1. User submits protein sequence
2. Job processed normally by worker
3. Client polls for completion
4. On completion, client encrypts protein + DNA sequences
5. Client sends encrypted data to replace plaintext
6. Job marked as `isEncrypted: true`

#### Viewing Saved Jobs (Encrypted)

1. User views job list (shows job IDs, dates, status - not encrypted)
2. User clicks to view details
3. Client prompts for encryption password (or uses cached key from sessionStorage)
4. Client decrypts and displays sequences

#### Password Management

- Key cached in `sessionStorage` for session duration
- Cleared on tab/browser close
- User can manually "lock" by clearing cache
- Password change requires decrypting all jobs with old key, re-encrypting with new

## User Interface

### Account Settings

```
Data Encryption
---------------

( ) Standard (default)
    Your data is stored securely but accessible to site
    administrators for support purposes.

( ) Encrypted Storage
    Your sequences are encrypted with a password only you know.
    Even administrators cannot read your data.

    [!] Warning: If you forget your password, your data cannot
    be recovered. There is no password reset for encrypted data.

    Password: [________________]
    Confirm:  [________________]

    [Enable Encryption]
```

### Password Prompt (when viewing encrypted job)

```
This job is encrypted
---------------------

Enter your encryption password to view:

Password: [________________]

[ ] Remember for this session

[Unlock]  [Cancel]
```

## Async Encryption for Custom Services (Advanced)

For services like custom vector construction where there may be days between user submission and result delivery, we use asymmetric encryption (public/private key pairs).

### The Problem

Basic encrypted storage requires the user's browser to be online to encrypt results immediately after processing. For async workflows (submit Monday, results ready Wednesday, user views Friday), we need a different approach.

### The Solution: Dual Key Pairs

- **BioGrammatics key pair**: We publish our public key; we keep our private key secure
- **User key pair**: User's public key stored on server; private key encrypted with their password

This allows:
- **User encrypts for us**: Data we need to process (only we can decrypt)
- **We encrypt for user**: Results (only they can decrypt)

### Workflow

```
USER SUBMITS JOB (Monday)
─────────────────────────
1. Browser generates random AES session key
2. Browser encrypts protein sequence with AES key
3. Browser encrypts AES key with BioGrammatics PUBLIC key
4. Sends encrypted package to server
5. Job sits encrypted - even we can't read it yet

WE PROCESS (Wednesday)
──────────────────────
1. Worker decrypts AES key with our PRIVATE key
2. Worker decrypts protein sequence
3. Worker performs optimization (plaintext in memory)
4. Worker generates new AES key for results
5. Worker encrypts results with new AES key
6. Worker encrypts AES key with USER's PUBLIC key
7. Stores encrypted results, deletes input
8. Results sit encrypted - now WE can't read them

USER VIEWS RESULTS (Friday)
───────────────────────────
1. User downloads encrypted results
2. User enters password to unlock their private key
3. Browser decrypts AES key with user's PRIVATE key
4. Browser decrypts and displays results
```

### Timeline Security

| Day | Data State | Who Can Read |
|-----|-----------|--------------|
| Mon-Tue | Input encrypted with our public key | Only us (with private key) |
| Wed | Plaintext in memory during processing | Server only, briefly |
| Wed-Fri | Results encrypted with user's public key | Only user (with private key) |
| Forever | Encrypted in database | Only user |

### Schema for Async Encryption

```prisma
model User {
  // Existing fields...

  // User's key pair for receiving encrypted results
  publicKey              String?   @db.Text  // RSA public key (PEM format)
  encryptedPrivateKey    String?   @db.Text  // RSA private key, encrypted with password
  privateKeySalt         String?             // Salt for password encryption
  privateKeyIV           String?             // IV for private key encryption
}

model VectorConstructionJob {
  id                String   @id @default(cuid())
  userId            String
  status            JobStatus

  // Input: encrypted FOR US (only we can decrypt)
  encryptedInput        String?  @db.Text
  inputKeyForUs         String?  @db.Text  // AES key encrypted with OUR public key
  inputIV               String?

  // Output: encrypted FOR USER (only they can decrypt)
  encryptedOutput       String?  @db.Text
  outputKeyForUser      String?  @db.Text  // AES key encrypted with USER's public key
  outputIV              String?

  // Non-sensitive metadata
  vectorBackbone        String?
  createdAt             DateTime @default(now())
  processedAt           DateTime?
}

enum JobStatus {
  PENDING_DECRYPTION   // Waiting for us to process
  PROCESSING           // We're working on it
  COMPLETED            // Done, encrypted for user
  FAILED
}
```

### Why Hybrid Encryption (RSA + AES)?

RSA can only encrypt small amounts of data (~256 bytes). So we:
1. Generate random AES key (symmetric, fast, handles any size)
2. Encrypt the actual data with AES
3. Encrypt only the small AES key with RSA

This is how TLS, PGP, S/MIME, and most real-world encryption systems work.

### Key Compromise Scenarios

| Scenario | Impact |
|----------|--------|
| Our private key leaked | Attacker can decrypt pending inputs (not yet processed). Cannot decrypt completed results. |
| User's private key leaked | Attacker can decrypt that specific user's results. Other users unaffected. |
| Database leaked | Encrypted blobs useless without corresponding private keys |
| Both keys leaked | Full compromise for that user's data |

### Security Properties

**At rest (database):**
- Input: Encrypted for us (only we can decrypt with our private key)
- Output: Encrypted for user (only they can decrypt with their private key)
- No plaintext ever stored persistently

**In transit:**
- HTTPS encryption
- Additional application-layer encryption

**In memory:**
- Plaintext only during active processing
- Cleared immediately after

---

## Dual-Access Encrypted Storage (Recommended)

For most use cases, we recommend a balanced approach: data is encrypted at rest, but both the user AND BioGrammatics can decrypt it. This provides security against database breaches while enabling support and data recovery.

### How It Works

Data is encrypted once with a random AES session key. The session key is then encrypted twice - once with the user's public key, once with BioGrammatics' public key. Both encrypted key copies are stored alongside the encrypted data.

```
┌─────────────────────────────────────────────────────────┐
│                    STORED DATA                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  encryptedData: [AES-encrypted sequences]               │
│  dataIV: [initialization vector]                        │
│                                                         │
│  keyForUser: [AES key encrypted with USER's public key] │
│  keyForBG: [AES key encrypted with BG's public key]     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Schema

```prisma
model EncryptedJob {
  id                String   @id @default(cuid())
  userId            String
  status            JobStatus

  // Data encrypted with AES session key (single copy)
  encryptedData     String?  @db.Text  // Contains protein, DNA, vector, etc.
  dataIV            String?            // Initialization vector

  // AES session key - two copies with different encryption
  keyForUser        String?  @db.Text  // AES key encrypted with user's public key
  keyForBG          String?  @db.Text  // AES key encrypted with BioGrammatics' public key

  // Non-sensitive metadata (plaintext)
  jobType           String?            // "codon-optimization", "vector-construction"
  vectorBackbone    String?
  createdAt         DateTime @default(now())
  processedAt       DateTime?
}
```

### Access Scenarios

| Who | How They Access | Use Case |
|-----|-----------------|----------|
| User | Decrypts `keyForUser` with their private key | Normal viewing of their data |
| BioGrammatics | Decrypts `keyForBG` with our private key | Support, troubleshooting, legal |
| Attacker with DB dump | Cannot decrypt - no private keys | Breach protection |

### Workflow

```
USER SUBMITS JOB
────────────────
1. Browser generates random AES session key
2. Browser encrypts protein sequence with AES key
3. Browser encrypts AES key with BioGrammatics PUBLIC key
4. Sends to server

WE PROCESS
──────────
1. Worker decrypts AES key with our PRIVATE key
2. Worker decrypts and processes data
3. Worker generates NEW AES session key for results
4. Worker encrypts results with new AES key
5. Worker encrypts AES key TWICE:
   - Once with User's PUBLIC key → keyForUser
   - Once with BioGrammatics' PUBLIC key → keyForBG
6. Stores encrypted results with both key copies

USER OR BG VIEWS
────────────────
User: Decrypts keyForUser with their private key → decrypts data
BG:   Decrypts keyForBG with our private key → decrypts data
```

### Security Properties

**Protects against:**
- Database breaches (encrypted blobs useless without private keys)
- Stolen backups
- Unauthorized internal access (requires BG private key)

**Allows:**
- User self-service access to their data
- BioGrammatics support access when needed
- Data recovery if user forgets password
- Compliance with legal requests

### Comparison of Approaches

| Feature | Standard | User-Only Encrypted | Dual-Access Encrypted |
|---------|----------|---------------------|----------------------|
| Breach protection | No | Yes | Yes |
| User can access | Yes | Yes | Yes |
| BG can access | Yes | No | Yes |
| Password recovery | N/A | No | Yes (BG can help) |
| Support possible | Yes | Limited | Yes |
| Legal compliance | Easy | Impossible | Possible |

### User Messaging for Dual-Access

> Your data is encrypted and protected from unauthorized access, including database breaches. You access your data with your encryption password. BioGrammatics maintains a secure backup key for support purposes and data recovery - this ensures you won't lose access to your work if you forget your password.

### When to Use Each Approach

**Standard Storage:** Quick jobs, non-sensitive data, users who don't want to manage passwords

**Dual-Access Encrypted:** Most users with sensitive data - balances security with practicality

**User-Only Encrypted:** High-security requirements where even BioGrammatics must not have access (rare - pharmaceutical trade secrets, specific compliance requirements)

---

## Explaining Encryption to Users

When presenting encryption options to users, clarity is essential. Users should understand both the benefits and responsibilities that come with encrypted storage.

### Messaging Guidelines

**For Standard Storage:**

> Your data is protected by industry-standard security measures including encrypted connections and access controls. Our team may access your data to provide support or troubleshoot issues. This is the default option and works seamlessly with all features.

**For Encrypted Storage (Dual-Access - Recommended):**

> With encrypted storage, your sequences are encrypted before being stored in our database. This protects your data from unauthorized access, including database breaches. You access your data with your encryption password. BioGrammatics maintains a secure backup key for support purposes and data recovery.

**For Private Encrypted Storage (User-Only Access):**

> With private encrypted storage, your sequences are protected by a password that only you know. Your data is encrypted before it's stored, and only you can decrypt it. Even our administrators cannot view your sequences.
>
> **Important:** If you forget your encryption password, your data cannot be recovered. We do not have a copy of your password and cannot reset it. Please store your password securely.

**For Async/Advanced Encryption (Custom Services):**

> When you submit a custom project, your sequences are encrypted so that only our processing systems can read them. Once complete, the results are encrypted so that only you can access them. Your data remains encrypted at all times except during the brief moment of active processing.

### Key Points to Communicate

1. **It's optional**: Encryption is a choice, not a requirement. Most users are fine with standard storage.

2. **Password = Key**: The encryption password is the key to their data. No password recovery exists by design.

3. **We can't help if locked out**: Support cannot recover encrypted data. This is a feature, not a limitation.

4. **Processing requires temporary access**: We must be able to read sequences to optimize them. Encryption protects storage, not processing.

5. **Different from login**: The encryption password is separate from their account login (which uses magic links).

### FAQ for Users

**Q: Why would I need encrypted storage?**
A: If you're working with proprietary sequences or have compliance requirements (pharmaceutical research, trade secrets), encrypted storage ensures only you can access your data.

**Q: Can BioGrammatics see my sequences?**
A: With standard storage, yes. With dual-access encrypted storage, only with our secure backup key (used for support/recovery). With private encrypted storage, no - we cannot read your data at all.

**Q: What if I forget my password?**
A: With dual-access encryption (default), we can help you recover access using our backup key. With private encryption, your data cannot be recovered - this is intentional for maximum security. We recommend using a password manager.

**Q: Is my data encrypted during optimization?**
A: During the brief processing time, your sequence must be decrypted in server memory. It is never stored unencrypted and is cleared from memory immediately after processing.

**Q: Can I switch between standard and encrypted?**
A: Yes. Switching to encrypted will encrypt all future jobs. Existing jobs can be migrated. Switching back to standard requires your password to decrypt.

---

## Future Considerations

1. **Password strength requirements**: Enforce minimum complexity for encryption passwords

2. **Key rotation**: Periodic re-encryption with new keys

3. **Hardware key support**: WebAuthn/FIDO2 for key derivation

4. **Audit logging**: Log encryption/decryption events (without logging actual data)

5. **Team encryption**: Shared encryption for team accounts (more complex key management)

6. **Export**: Allow encrypted export of all user data

7. **Key escrow (optional)**: For enterprise customers, optional key escrow with their IT department

8. **HSM integration**: Hardware Security Modules for our private key storage

## Compliance Notes

- GDPR: Encrypted storage supports "right to be forgotten" (delete salt = data unrecoverable)
- HIPAA: May require additional controls depending on data classification
- SOC 2: Encryption at rest is a common control requirement

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [PBKDF2 (RFC 2898)](https://tools.ietf.org/html/rfc2898)
- [AES-GCM (NIST SP 800-38D)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
