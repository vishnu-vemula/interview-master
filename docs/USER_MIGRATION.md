# Existing user identity migration

`api/src/scripts/migrate-users.ts` imports legacy bcrypt accounts to Firebase Auth and creates UUID users in PostgreSQL. The companion `migrate-related.ts` imports a snapshot of related MongoDB records and the optional legacy PostgreSQL `jobs` table. The live API now reads PostgreSQL, so stop all legacy writes and reconcile source/destination data before routing traffic to it.

## Preparation

1. Freeze new registration and writes during the final migration window. Back up MongoDB, PostgreSQL and private resume objects to encrypted, access-controlled storage. Restore the backups to staging and verify record counts before writing to production.
2. Create the Firebase project; enable Email/Password and Google providers and authorized domains. Grant the API a service account or Application Default Credentials. Use a separate staging project first.
3. Apply Prisma migrations to the target database with `npx prisma migrate deploy` from `api/`. Set `MONGO_URI` to the frozen legacy snapshot, `DATABASE_URL` to the destination, `LEGACY_JOBS_DATABASE_URL` to the old PostgreSQL job database if it exists, `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` for a real project. Do not set `FIREBASE_AUTH_EMULATOR_HOST` outside local tests.
4. Run `npm run migrate:users` from `api/` for a read-only dry run. Resolve every reported collision, especially a Firebase email already owned by a different UID. Never auto-link by email.
5. Run `npm run migrate:users -- --apply` once, then run it again. The second run should report `alreadyPresent`, no new imports and no failures. Keep the JSON output as an audit artifact in a restricted location.

The script uses deterministic `im_<Mongo ObjectId>` Firebase UIDs and deterministic UUID v5 PostgreSQL IDs. It checks existing UIDs and email collisions before importing; retries do not overwrite existing Firebase users or PostgreSQL roles. Bad or missing bcrypt hashes create Firebase accounts without passwords and increment `resetRequired`; those users must use password reset after email verification. Migrated accounts start with `emailVerified=false` because the legacy database does not prove verification. Admin roles are copied only from existing server-side records.

## Verification before cutover

- Compare source user count with `imported + alreadyPresent + failed`. Resolve all failures and rerun.
- In a **real Firebase staging project**, sign in with a representative imported bcrypt password, verify an email, reset a password and use Google sign-in. The local Auth Emulator does not authenticate imported bcrypt hashes even though it accepts the import operation.
- Check the source MongoDB user, Firebase UID and PostgreSQL UUID map to the same email, role and status. Check one candidate and each admin role. Confirm a chosen email cannot promote a new Firebase account.
- Check disabled and banned users cannot use HTTP or Socket.IO. Verify token revocation and role changes.
- Run the companion related-data import and validate counts and representative joins before switching traffic to the PostgreSQL build. The scripts do not stop legacy writes.

## Rollback

Keep the legacy application and backed-up MongoDB data available until related data migration and read/write parity are verified. Do not delete a Firebase user solely because a rerun fails; a prior import may have succeeded. A failed user row can be retried after correcting collisions. Roll back application traffic to the previous build if staging checks fail, and reconcile in-flight PayU events before retrying. Never restore over the only copy of billing or audit records.

## One-time super admin bootstrap

Create and email-verify an enabled Firebase user in the intended project, then set
`ADMIN_BOOTSTRAP_FIREBASE_UID` and `ADMIN_BOOTSTRAP_EMAIL` to that exact account.
With `DATABASE_URL` and `FIREBASE_PROJECT_ID` set, run `npm run seed:admin` from
`api/`. This command uses a PostgreSQL advisory transaction lock and refuses to
promote an existing application user or run when any staff account already
exists. Review the resulting User row, then remove the bootstrap variables.
Subsequent role changes must be made by the current super admin through the
admin API. Never use a client role claim or email match for promotion.
## Related application data

After `migrate:users -- --apply` has completed without failures, run
`npm run migrate:related` for a read-only count preview, then
`npm run migrate:related -- --apply` against a backed-up, write-frozen source.
The second command imports resumes, interviews and embedded questions,
sessions and answers, plans, PayU orders, subscriptions, usage entries and counters,
PayU event logs, MongoDB job listings, the optional legacy PostgreSQL `jobs` table,
templates, prompts, settings, transactions, scraper configuration/logs and audit events into their
PostgreSQL tables. IDs are deterministic UUIDs derived from MongoDB IDs;
re-running the command leaves existing target rows alone. It reports a failure
for each record it cannot import and exits unsuccessfully when failures exist.

Legacy Cloudinary `upload` resumes are deliberately flagged as
`legacy_public_resume_requires_private_reupload`, but their database row and
legacy storage metadata are retained. The object must be moved to authenticated
private delivery and its storage reference reconciled before exposing downloads.
Settings with secrets are scrubbed and reported as warnings. Resolve every
warning and exception; dry-run gives counts and ID mapping but cannot validate
individual write outcomes. The importer is a snapshot import, so source writes
must remain stopped through final reconciliation and traffic switch.
