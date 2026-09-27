# Implementation status (2026-09-27)

The application is **not production ready against the supplied acceptance criteria**. PayU and Firebase flows have local tests, and the PostgreSQL migration is valid, but the running application still uses MongoDB for most data. No live PayU sandbox, Cloudinary, Groq, or real Firebase project credentials were supplied.

## Verified locally

- API TypeScript build and frontend Vite production builds in legacy and Firebase modes.
- `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities in both packages.
- PayU hash and callback validation, tamper rejection, checkout idempotency, captured-payment confirmation, delayed and duplicate notifications, allowance snapshots, refund initiation and confirmed refund tested against disposable MongoDB with a mocked PayU network boundary.
- Firebase Auth Emulator integration: email verification gate, repeat sign-ins produce one internal Mongo user, invalid and revoked tokens, admin and owner denial, chosen-email takeover denial, authenticated Socket.IO denial, and account deletion.
- Playwright browser flow: register, verify through the Auth Emulator, sign in, load profile, delete account.
- PostgreSQL 17.11: the initial Prisma migration applies to a disposable database. It creates 23 foreign keys. Tests verify cross-interview answer rejection and one active default resume per user.
- MongoDB concurrency test: ten simultaneous session starts produce one active session; concurrent answer saves retain one answer per question.
- Mocked Groq provider boundary test: malformed question and evaluation output are retryable; generation uses a lease so an abandoned attempt can be reclaimed; repeat requests do not duplicate questions, completion or usage debit. Empty answers and incomplete sessions are rejected.
- Legacy OAuth callback rejects signed states without the short-lived, HTTP-only browser nonce cookie. Public PayU callback bodies are capped at 32 KB.
- Idempotent bcrypt identity migration script tested with Firebase Auth Emulator and disposable MongoDB/PostgreSQL. The emulator accepts imported hashes but **cannot validate bcrypt sign-in**; a real Firebase project test remains required.
- Local `interviewmaster` MongoDB had zero users, resumes, interviews, sessions, plans and payment orders when checked, so there was no local historical data to cut over.

## Implemented but awaiting external verification

- PayU India hosted checkout, verified webhook/reconciliation, fixed-duration paid passes, refund initiation/status, pricing, candidate result and admin read-only financial reporting. Need sandbox merchant key/salt and public HTTPS callback to run a real transaction.
- Authenticated Cloudinary PDF uploads and 60-second owner-checked download URLs. Need Cloudinary account to smoke test actual storage and object cleanup. Old public resume objects need re-upload or secure migration.
- Firebase browser/API path controlled by `VITE_AUTH_PROVIDER=firebase` and `AUTH_PROVIDER=firebase`. Need actual Firebase project, authorized domain, Google sign-in enablement and Admin credentials for non-emulator use. Firebase roles still reside in MongoDB during the bridge phase.
- Groq generation, evaluation and live follow-ups need configured provider credentials and a browser journey.

## Outstanding from the production specification

- The Prisma schema is a tested **target**, not the live application store. Controllers, billing, jobs, admin, background jobs and authorization still largely use MongoDB. The split legacy PostgreSQL job reader and MongoDB job writer remain. A user-only Firebase/PostgreSQL import exists; related historical documents, payment records and job listings are not migrated.
- Firebase identity is opt-in while legacy JWT and password routes remain available in legacy mode. Their removal requires the data cutover and real-project migration verification.
- Redis-backed durable parsing, generation, evaluation and job ingestion with PostgreSQL job state are not implemented. Generation and evaluation still run in request processes; process failure recovery is incomplete.
- PayU recurring standing instructions, automated renewal, cancellation and customer self-service portal are not implemented. Paid plans are one-time passes. No live sandbox transaction or refund was performed.
- Account deletion handles current MongoDB candidate data, Cloudinary cleanup and Firebase identity in Firebase mode, with anonymized PayU contact fields. It has no durable retry queue if external storage deletion fails; an administrator must retry a stranded legacy deletion. Operational retention and backup automation need deployment decisions.
- Full browser acceptance across resume upload, AI, PayU, job sync and admin workflows, staging smoke testing, monitoring, backup restore drill and deployment pipeline remain unverified or unimplemented.
- A Compose local service definition, a GitHub verification workflow and an operations runbook now exist. Docker was unavailable on this workstation, and the GitHub workflow and restore drill have not run yet.

Do not deploy solely because builds and local tests pass. See [the PayU guide](PAYU.md), [schema contract](POSTGRESQL_SCHEMA.md), and [identity migration guide](USER_MIGRATION.md).
