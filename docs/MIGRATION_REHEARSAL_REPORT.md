# Disposable migration rehearsal — 2026-09-27

The local integration test imported a synthetic MongoDB snapshot and a synthetic legacy PostgreSQL job row into a disposable PostgreSQL database. The source included one user and one row in each related data category below. The import mapped the user to its deterministic PostgreSQL ID, created every related row, and then reran without creating duplicates. It did not read production data.

| Category | Source | Mapped | Created | Present on rerun |
| --- | ---: | ---: | ---: | ---: |
| Users | 1 | 1 | 1 | 1 |
| Resumes | 1 | 1 | 1 | 1 |
| Interviews | 1 | 1 | 1 | 1 |
| Questions | 1 | 1 | 1 | 1 |
| Sessions | 1 | 1 | 1 | 1 |
| Answers | 1 | 1 | 1 | 1 |
| Plans | 1 | 1 | 1 | 1 |
| Payment orders | 1 | 1 | 1 | 1 |
| Subscriptions | 1 | 1 | 1 | 1 |
| Usage ledger | 1 | 1 | 1 | 1 |
| Usage counters | 1 | 1 | 1 | 1 |
| Payment events | 1 | 1 | 1 | 1 |
| MongoDB jobs | 1 | 1 | 1 | 1 |
| Legacy PostgreSQL jobs | 1 | 1 | 1 | 1 |
| Audit events | 1 | 1 | 1 | 1 |
| Transactions | 1 | 1 | 1 | 1 |
| Templates | 1 | 1 | 1 | 1 |
| Prompts | 1 | 1 | 1 | 1 |
| Settings | 1 | 1 | 1 | 1 |
| Scraper configuration | 1 | 1 | 1 | 1 |
| Scraper logs | 1 | 1 | 1 | 1 |

The related-data importer reported **zero exceptions and zero warnings**. The user import dry run inspected one account; the apply run imported one, and the rerun reported one already present. The rehearsal ran as part of `npm test` in `api/` with the Auth Emulator, disposable MongoDB databases and `TEST_DATABASE_URL` pointing to `interviewmaster_test`.

This report establishes importer behavior on the sample fixture only. A restored and write-frozen copy of the actual legacy MongoDB database, the legacy PostgreSQL jobs database, and Cloudinary objects is required for the real cutover report. Compare every category, investigate warnings or failures, verify representative owner and payment joins, and retain the source backups until signed off.
