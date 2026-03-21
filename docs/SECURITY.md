# Security

Baseline is a local-first app. Your data never leaves your machine and no cloud services are involved. This document describes how data is stored and protected.

## Data storage

All user data is stored as plaintext files in a vault folder you choose:

| File(s) | Contents |
|---|---|
| `.baseline/config.json` | App settings, Oura OAuth tokens, YNAB Personal Access Token |
| `check-ins/YYYY-MM-DD.md` | Daily check-in entries |
| `oura/oura.csv` | Synced Oura ring data |
| `ynab/spending.csv` | Synced YNAB spending data |
| `screenings/{type}/YYYY-MM-DD.json` | Screening results (e.g. PHQ-9) |
| `.baseline/clinician-notes.json` | Saved clinician snippets |
| `.baseline/appointments.json` | Appointment records |
| `.baseline/chat*.json` | Chat history (if persistent mode is enabled) |

Encryption is **off by default**. When enabled, all of the above files are encrypted in place using AES-256-GCM. Two additional files are created and are never encrypted:

| File | Contents |
|---|---|
| `.baseline/vault.meta` | Encryption state flags and password-derived key material (no raw keys) |
| `.baseline/vault.key` | Vault key encrypted by the OS keychain (absent when password-only mode is active) |

## Encryption

When vault encryption is enabled, each file is encrypted individually using **AES-256-GCM** with a unique random IV per write. The binary format is:

```
IV (12 bytes) | ciphertext | GCM auth tag (16 bytes)
```

The GCM auth tag ensures both confidentiality and integrity — any tampering with a file will be detected on the next read.

## Key management

A 256-bit vault key is generated using `crypto.randomBytes(32)` and never written to disk in plaintext. How it is stored depends on which unlock methods are configured:

### macOS Keychain only (default)

The vault key is encrypted by Electron's `safeStorage` API, which delegates to the macOS Keychain. The encrypted blob is stored in `vault.key`. The app unlocks automatically when opened by the same OS user on the same machine.

### Password

When a master password is set, a **wrapping key** is derived from the password using **scrypt** (`N=16384, r=8, p=1`), a memory-hard key derivation function designed to resist brute-force attacks. A random 32-byte salt is generated and stored in `vault.meta`.

The vault key is AES-256-GCM encrypted with the wrapping key and stored in `vault.meta` as `wrappedKey`. The raw vault key is **not** stored in the macOS Keychain when a password is active — there is no silent fallback. A forgotten password without a Touch ID backup means the data is permanently unrecoverable.

### Touch ID backup (optional)

When Touch ID is explicitly enabled as a backup to a password, a copy of the vault key is stored in the macOS Keychain (via `safeStorage`) in addition to the password-wrapped copy. On launch, a Touch ID prompt fires automatically; success loads the key from the Keychain. If Touch ID fails or is cancelled, the password prompt is shown instead.

Touch ID backup is a **deliberate user choice** — it is not enabled automatically when a password is set, and it is the only way to recover a forgotten password.

## Unlock flow summary

| Configuration | Unlock method | Forgot password? |
|---|---|---|
| No encryption | None (automatic) | N/A |
| Keychain only | Automatic (same machine/user) | N/A |
| Password only | Password prompt | Data unrecoverable |
| Password + Touch ID backup | Touch ID (auto-prompt), falls back to password | Touch ID recovers access |

## Third-party credentials

Oura OAuth tokens and the YNAB Personal Access Token are stored in `config.json` inside the vault. When encryption is enabled, `config.json` is encrypted along with all other vault files. When encryption is off, these credentials are stored in plaintext — users who handle sensitive token data are encouraged to enable encryption.

Credentials are never transmitted anywhere other than the respective first-party APIs (Oura, YNAB).

## Plaintext export

The **Export vault as plaintext** option in Settings decrypts all vault files into a ZIP archive saved to a location you choose. The exported ZIP is unencrypted — treat it with the same care as any sensitive document.

## No telemetry

Baseline collects no analytics, crash reports, or usage data. No data is sent to Anthropic or any other third party.
