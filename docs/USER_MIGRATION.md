# Existing user identity migration

`api/src/scripts/migrate-users.ts` imports legacy bcrypt accounts to Firebase Auth and writes matching UUID users to PostgreSQL while recording the Firebase UID on the temporary MongoDB bridge. It is **user identity migration only**. Do not switch off MongoDB based on this script; resume, interview, session, billing and job records still need a verified migration and application cutover.

## Preparation

1. Freeze new registration and writes during the final migration window. Back up MongoDB, PostgreSQL and private resume objects to encrypted, access-controlled storage. Restore the backups to staging and verify record counts before writing to production.
2. Create the Firebase project; enable Email/Password and Google providers and authorized domains. Grant the API a service account or Application Default Credentials. Use a separate staging project first.
3. Apply Prisma migrations to the target database with `npx prisma migrate deploy` from `api/`. Set `MONGO_URI`, `DATABASE_URL`, `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` for a real project. Do not set `FIREBASE_AUTH_EMULATOR_HOST` outside local tests.
4. Run `npm run migrate:users` from `api/` for a read-only dry run. Resolve every reported collision, especially a Firebase email already owned by a different UID. Never auto-link by email.
5. Run `npm run migrate:users -- --apply` once, then run it again. The second run should report `alreadyPresent`, no new imports and no failures. Keep the JSON output as an audit artifact in a restricted location.

The script uses deterministic `im_<Mongo ObjectId>` Firebase UIDs and deterministic UUID v5 PostgreSQL IDs. It checks existing UIDs and email collisions before importing; retries do not overwrite existing Firebase users or PostgreSQL roles. Bad or missing bcrypt hashes create Firebase accounts without passwords and increment `resetRequired`; those users must use password reset after email verification. Migrated accounts start with `emailVerified=false` because the legacy database does not prove verification. Admin roles are copied only from existing server-side records.

## Verification before cutover

- Compare source user count with `imported + alreadyPresent + failed`. Resolve all failures and rerun.
- In a **real Firebase staging project**, sign in with a representative imported bcrypt password, verify an email, reset a password and use Google sign-in. The local Auth Emulator does not authenticate imported bcrypt hashes even though it accepts the import operation.
- Check the source MongoDB user, Firebase UID and PostgreSQL UUID map to the same email, role and status. Check one candidate and each admin role. Confirm a chosen email cannot promote a new Firebase account.
- Check disabled and banned users cannot use HTTP or Socket.IO. Verify token revocation and role changes.
- Import and validate all related application data before switching the application to PostgreSQL. The current script does **not** do this step.

## Rollback

Keep the legacy application and backed-up MongoDB data available until related data migration and read/write parity are verified. Do not delete a Firebase user solely because a rerun fails; a prior import may have succeeded. A failed user row can be retried after correcting collisions. Roll back application traffic to the previous build if staging checks fail, and reconcile in-flight PayU events before retrying. Never restore over the only copy of billing or audit records.
