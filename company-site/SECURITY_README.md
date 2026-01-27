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

## Future Considerations

1. **Password strength requirements**: Enforce minimum complexity for encryption passwords

2. **Key rotation**: Periodic re-encryption with new keys

3. **Hardware key support**: WebAuthn/FIDO2 for key derivation

4. **Audit logging**: Log encryption/decryption events (without logging actual data)

5. **Team encryption**: Shared encryption for team accounts (more complex key management)

6. **Export**: Allow encrypted export of all user data

## Compliance Notes

- GDPR: Encrypted storage supports "right to be forgotten" (delete salt = data unrecoverable)
- HIPAA: May require additional controls depending on data classification
- SOC 2: Encryption at rest is a common control requirement

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [PBKDF2 (RFC 2898)](https://tools.ietf.org/html/rfc2898)
- [AES-GCM (NIST SP 800-38D)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
