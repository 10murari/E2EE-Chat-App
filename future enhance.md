# Future Enhancements

## Security & Privacy
- Add forward secrecy with per-message ephemeral session keys.
- Implement post-compromise security (automatic key ratcheting).
- Add key transparency / public key audit logs to reduce MITM risk.
- Support device-based key management for multi-device accounts.
- Add optional metadata protection features (timing obfuscation, sealed sender-style delivery).

## Messaging Features
- Add encrypted group chat with sender keys.
- Add encrypted file/image/video attachments with chunked uploads.
- Add message edit/delete support with secure history handling.
- Add reactions, replies, and thread support.
- Add offline message queueing and robust delivery retry.

## Authentication & Account
- Add MFA (TOTP + backup codes).
- Add passwordless login options (WebAuthn / passkeys).
- Add account recovery flow with secure key backup options.
- Add session/device management dashboard (revoke active sessions).

## Reliability & Scalability
- Add Redis for socket session/state scaling.
- Introduce message broker for high-throughput event delivery.
- Add rate limiting and abuse protection on API/socket endpoints.
- Add observability stack (structured logs, metrics, traces, alerting).
- Add zero-downtime deployment strategy and rollback automation.

## Developer Experience & Quality
- Add unit/integration/e2e tests for auth, crypto flows, and sockets.
- Add CI pipeline (lint, test, security scan, build checks).
- Add dependency vulnerability scanning and SAST.
- Add API documentation (OpenAPI/Swagger) and architecture diagrams.
- Add seed scripts and local dev containers for easier onboarding.

## Product & UX
- Add message search with encrypted index strategy.
- Add typing indicators and read receipts (privacy-tunable).
- Add notification controls (mute, DND, per-chat settings).
- Improve accessibility (keyboard navigation, ARIA, contrast).
- Add localization/i18n support.
