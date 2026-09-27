# Local environment and operations

## Fresh local setup

1. Install Node.js 22, Docker with Compose, and the dependencies in both `api` and `frontend` using `npm ci`.
2. Run `docker compose up -d` from the repository root. This starts MongoDB, PostgreSQL 17 and Redis on loopback only. The Compose password is for local development only.
3. Copy `api/.env.example` to `api/.env` and `frontend/.env.example` to `frontend/.env`. Set `DATABASE_URL=postgresql://interviewmaster:local_development_only@127.0.0.1:5432/interviewmaster` and provide local test or real provider values as appropriate. Never commit either `.env` file.
4. Run `npm run prisma:generate` and `npx prisma migrate deploy` in `api`. The PostgreSQL schema is currently a **migration target**; the running API still uses MongoDB for application data. Run the Firebase Auth Emulator with `npx firebase-tools@15.31.0 emulators:start --only auth --project demo-interviewmaster` from `api` when using Firebase mode locally.
5. Run `npm run dev` in `api` and `frontend`. Set both `AUTH_PROVIDER=firebase` and `VITE_AUTH_PROVIDER=firebase` for the Firebase path. Configure matching Firebase demo project IDs and the emulator URL. The API readiness endpoint is `/api/ready`.
6. Run `npm run build` in each package. The `Verify` GitHub workflow provisions disposable databases and the Auth Emulator, applies the Prisma migration, runs API integration tests, and runs the browser authentication journey. The workflow has been added but has not yet run on GitHub.

The `.env.example` files are the variable reference. Current required API settings are `MONGO_URI`, `GROQ_API_KEY`, Cloudinary cloud/key/secret, `CLIENT_URL`, `API_PUBLIC_URL`, PayU merchant key/salt/mode, and either Firebase project configuration or legacy JWT secrets. Production startup also requires `OPENAI_API_KEY` and Redis. `DATABASE_URL` is needed for Prisma migration and the legacy PostgreSQL job reader; it is not yet the primary application store. The frontend needs `VITE_API_URL`, and Firebase mode also needs the Firebase web configuration values. Optional settings include Adzuna credentials, Resend email credentials, and legacy Google/LinkedIn OAuth credentials.

## Backup and restore before a data migration

Use a maintenance window or a consistent database snapshot. Record backup time, source database names, code revision, Prisma migration version, Firebase project ID, Cloudinary account and PayU merchant account. Keep all exports encrypted and access controlled. A live write stream continuing across independent MongoDB, PostgreSQL, Firebase and object storage backups is **not** a transactionally consistent backup.

Example commands using explicit connection strings supplied through environment variables:

```bash
mongodump --uri "$MONGO_BACKUP_URI" --archive=interviewmaster-mongo.archive --gzip
pg_dump --format=custom --no-owner --file=interviewmaster-postgres.dump "$DATABASE_URL"
```

For a disposable restore drill, create new empty databases, then run:

```bash
mongorestore --uri "$MONGO_RESTORE_URI" --archive=interviewmaster-mongo.archive --gzip --drop
pg_restore --dbname "$RESTORE_DATABASE_URL" --no-owner --clean --if-exists interviewmaster-postgres.dump
```

`--drop` and `--clean` destroy objects in the **restore target**. Verify the target connection strings point to dedicated empty drill databases before running. Never use the production URLs for the restore drill. Cloudinary resume objects and Firebase Auth users require separately managed exports or provider backup arrangements; these two commands do not capture them. Test a private resume download and an imported user's sign-in against the drill/staging environment. Compare counts of users, resumes, interviews, sessions, payment orders and active subscriptions with the source. Run the relationship checks in `docs/POSTGRESQL_SCHEMA.md` and reconcile PayU order totals before considering cutover.

## Deployment and rollback gate

The running application has **not** completed its PostgreSQL/Firebase cutover and does not meet the supplied production acceptance criteria. Do not advertise it as production ready. Before any launch, run the user and related-data migration against a backup copy, verify a real Firebase project bcrypt import and Google sign-in, execute a PayU sandbox payment/refund through public HTTPS callbacks, test Cloudinary cleanup and real AI timeouts, and restore a backup. See `docs/IMPLEMENTATION_STATUS.md` for the remaining work.

Deploy the API and frontend from the same reviewed revision. Apply `prisma migrate deploy` before switching traffic. Configure HTTPS `CLIENT_URL` and `API_PUBLIC_URL` with no path/query, restricted CORS, secrets from a secret manager, real Firebase Admin credentials, PayU merchant configuration, Redis, and logging/alerting. Probe `/api/ready` before routing traffic. A rollback should first stop new writes and PayU checkout, preserve the current databases and webhook logs, then return to the prior reviewed revision and reconcile any payment notifications received during the change. Do not reverse an applied schema migration without a verified restoration plan.

Watch readiness failures, callback 4xx/5xx rates, pending payment and refund age, stuck `generating`/`evaluating` sessions, Redis connectivity, Cloudinary cleanup failures, and AI error rates. The current implementation does not include automated alert rules or a durable work queue; operators must inspect these manually until those are added.
