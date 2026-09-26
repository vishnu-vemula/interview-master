# PostgreSQL target schema

The source of truth is [`api/prisma/schema.prisma`](../api/prisma/schema.prisma) and the initial migration in `api/prisma/migrations/20260927_initial`. This schema is **not yet the running application's primary store**. It was applied to PostgreSQL 17.11 on a disposable `interviewmaster_test` database. The database reported 23 foreign keys, and the integration test checked the cross-interview answer constraint and active-default-resume index.

```mermaid
erDiagram
  User ||--o{ Resume : owns
  User ||--o{ Interview : creates
  User ||--o{ Session : conducts
  User ||--o{ Subscription : purchases
  User ||--o{ PaymentOrder : places
  User ||--o{ UsageLedgerEntry : uses
  User ||--o| BillingCustomer : maps
  User |o--o{ AuditEvent : acts
  User |o--o{ BackgroundJob : owns
  Resume ||--o{ ResumeChunk : contains
  Resume |o--o{ Interview : informs
  Interview ||--o{ Question : contains
  Interview ||--o{ Session : starts
  Interview |o--o{ UsageLedgerEntry : charges
  Session ||--o{ Answer : contains
  Session |o--o{ UsageLedgerEntry : charges
  BackgroundJob |o--o| Session : evaluates
  Question ||--o{ Answer : answers
  Plan ||--o{ PaymentOrder : ordered
  Plan ||--o{ Subscription : grants
  PaymentOrder |o--o| Subscription : fulfills
  JobSource ||--o{ JobListing : supplies
  JobSource ||--o{ JobSyncRun : syncs
```

`Answer.interviewId` is part of both composite foreign keys. The database therefore rejects an answer whose question belongs to a different interview than its session. `Resume_one_active_default_per_user` is a partial unique index on `userId` for rows with `isDefault = true` and `deletedAt IS NULL`; Prisma cannot represent that index in the pinned version.

## Foreign keys and deletion

This table was checked against `pg_constraint` after applying the migration. “Set null” applies only to nullable references. Restrict means the parent must be retained or dependents handled explicitly.

| Child column(s) | Parent | On delete |
| --- | --- | --- |
| `Answer(questionId, interviewId)` | `Question(id, interviewId)` | Restrict |
| `Answer(sessionId, interviewId)` | `Session(id, interviewId)` | Cascade |
| `AuditEvent.actorUserId` | `User.id` | Set null |
| `BackgroundJob.ownerUserId` | `User.id` | Set null |
| `BillingCustomer.userId` | `User.id` | Restrict |
| `Interview.resumeId` | `Resume.id` | Set null |
| `Interview.userId` | `User.id` | Cascade |
| `JobListing.sourceId` | `JobSource.id` | Restrict |
| `JobSyncRun.sourceId` | `JobSource.id` | Restrict |
| `PaymentOrder.planId` | `Plan.id` | Restrict |
| `PaymentOrder.userId` | `User.id` | Restrict |
| `Question.interviewId` | `Interview.id` | Cascade |
| `Resume.userId` | `User.id` | Cascade |
| `ResumeChunk.resumeId` | `Resume.id` | Cascade |
| `Session.evaluationJobId` | `BackgroundJob.id` | Set null |
| `Session.interviewId` | `Interview.id` | Cascade |
| `Session.userId` | `User.id` | Cascade |
| `Subscription.orderId` | `PaymentOrder.id` | Restrict |
| `Subscription.planId` | `Plan.id` | Restrict |
| `Subscription.userId` | `User.id` | Restrict |
| `UsageLedgerEntry.interviewId` | `Interview.id` | Set null |
| `UsageLedgerEntry.sessionId` | `Session.id` | Set null |
| `UsageLedgerEntry.userId` | `User.id` | Cascade |

Deleting a resume retains interviews through `resumeSnapshot` and sets `resumeId` to null. In the current MongoDB application, resume deletion is instead blocked while an interview references it. Payment orders, subscriptions and billing customers restrict user deletion so that financial records cannot disappear accidentally. A complete account deletion workflow needs to anonymize retained records and remove stored files and Firebase identity before a production cutover.

## Reproduce the verification

Create a disposable PostgreSQL database named exactly `interviewmaster_test`, then run from `api/`:

```powershell
$env:DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/interviewmaster_test'
npx prisma migrate deploy
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm test
```

The schema test refuses to write to any database with a different name. It inserts temporary records and removes them afterward.
