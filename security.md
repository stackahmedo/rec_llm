# Security Model

## Threat model

VoiceLens processes potentially sensitive audio — interviews, meetings, field recordings. The threats we care about, in priority order:

1. API key exfiltration (XSS, malicious extension, shoulder-surfing)
2. Audio/transcript leakage to an unintended AI provider
3. Tampering with corrections used for model training
4. Unauthorized access to the file library

## Key handling

- Keys are encrypted with **AES-256-GCM** before being written to `localStorage`.
- The encryption key is derived from a workspace passphrase via **PBKDF2** (200k iterations).
- Keys are masked in the UI by default; the eye icon reveals them only while held.
- Keys are never logged, never sent to telemetry, never shipped in build artifacts.

## Network

- Every outbound request is direct browser → provider over **TLS 1.2+**.
- No VoiceLens-operated backend sees your audio or transcripts.
- If you proxy through your own edge function (see `deployment.md`), pin the upstream domain and strip the `Authorization` header before any logging.

## File library

- Files stay on the device where they were ingested unless you explicitly export.
- Export targets (S3, Drive) require their own scoped credentials.
- The **encryption** column in the library indicates whether the artifact is stored encrypted at rest.

## Corrections & training

- Only authenticated reviewers can accept a correction.
- Each correction is logged with reviewer ID, original segment, new text, and timestamp.
- Training data is reviewable and revertible from the Speakers view.

## Roles & access

- 3 default roles: **Admin**, **Reviewer**, **Viewer**.
- Admin manages engines, keys, and speaker profiles.
- Reviewer accepts/rejects corrections and exports files.
- Viewer is read-only.

## Reporting issues

Email security@voicelens.local (placeholder). Do not file public issues for vulnerabilities.
