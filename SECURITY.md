# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Security Model

OneFinance is a local-first desktop app; understanding what it does (and deliberately doesn't do) helps scope a report:

- **Database encryption at rest.** All financial data lives in a single local SQLite database encrypted with **SQLCipher**, keyed by a user-chosen master password. The password is held in memory only while the app is unlocked and is never written to disk.
- **No password recovery.** There is no recovery mechanism by design — a lost master password means the data is unrecoverable.
- **Encrypted exports & backups.** Manual exports and automatic backups are encrypted with the master password using **AES-256-GCM** with an **scrypt**-derived key. Tampering or a wrong password fails authentication loudly rather than decrypting silently-corrupt data. (Pre-2.0 plaintext exports can still be imported, as the upgrade path.)
- **Stay-unlocked via the OS keychain.** The optional stay-unlocked policy stores the encrypted key via Electron `safeStorage` (macOS Keychain / Windows DPAPI / Linux libsecret) with an absolute expiry — never in plaintext. If no secure keychain backend is available, the feature disables itself rather than degrade.
- **Session locking.** The app re-locks on idle timeout, OS sleep/screen-lock, manual lock (`Ctrl+Shift+L`), and clears the remembered key on any lock so a restart always requires the password.
- **Fully offline, no telemetry.** There are no user accounts, no cloud sync, and no analytics. The only outbound network traffic is fetching market quotes and FX rates (Yahoo Finance) for investment holdings the user tracks.
- **Process isolation.** The renderer never touches the database or filesystem directly — all privileged operations go through a preload-exposed IPC surface handled in the Electron main process.

Issues in any of the above — key handling, the encryption envelope, the IPC boundary, lock/unlock logic — are exactly what we want to hear about.

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, use one of these private channels:

- **GitHub private vulnerability reporting** (preferred): [Report a vulnerability](https://github.com/HarshPanchal01/OneFinance/security/advisories/new) via the repository's Security tab.
- **Email:** onefinanceteam@outlook.com

### What to Include

- A description of the vulnerability and the affected area (e.g. encryption, IPC, import parsing).
- Steps to reproduce, ideally with a minimal example.
- Potential impact as you understand it.

### Response

This is a two-person project, so response times are best-effort — we aim to acknowledge reports within a few days and will work with you on a fix and coordinated disclosure.

Thank you for helping keep OneFinance safe!
