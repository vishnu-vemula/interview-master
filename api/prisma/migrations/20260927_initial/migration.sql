-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('candidate', 'support', 'content_manager', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled', 'banned', 'deleting', 'deleted');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('pending', 'parsed', 'failed');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('pending', 'generating', 'generated', 'failed');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('draft', 'ready', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('started', 'in_progress', 'evaluating', 'evaluation_failed', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('pending', 'evaluating', 'completed', 'unavailable');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('one_time', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'refunded', 'expired', 'past_due');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'success', 'failed', 'refund_pending', 'refunded');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('received', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'candidate',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "parseStatus" "ParseStatus" NOT NULL DEFAULT 'pending',
    "extractedText" TEXT,
    "parsedData" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeChunk" (
    "id" UUID NOT NULL,
    "resumeId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "section" TEXT,
    "text" TEXT NOT NULL,
    "embeddingStatus" TEXT NOT NULL DEFAULT 'not_requested',
    "embeddingModel" TEXT,
    "embeddingVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "resumeId" UUID,
    "resumeSnapshot" JSONB,
    "jobTitle" TEXT NOT NULL,
    "company" TEXT,
    "jobDescription" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "generationStatus" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "status" "InterviewStatus" NOT NULL DEFAULT 'draft',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedKeywords" TEXT[],
    "rubric" JSONB,
    "generationVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'started',
    "currentQuestionOrdinal" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER,
    "feedback" JSONB,
    "evaluationJobId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "timeTakenSeconds" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "feedback" TEXT,
    "evaluationStatus" "EvaluationStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'one_time',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "amountMinor" INTEGER NOT NULL,
    "providerPriceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "entitlements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCustomer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "orderId" UUID,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "creditLimit" INTEGER NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "transactionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "creditLimit" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payuId" TEXT,
    "refundToken" TEXT,
    "refundRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'received',
    "error" TEXT,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedgerEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID,
    "interviewId" UUID,
    "feature" TEXT NOT NULL,
    "unitsDelta" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID,
    "resourceType" TEXT NOT NULL,
    "resourceId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSource" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobListing" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSyncRun" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "status" "JobState" NOT NULL DEFAULT 'queued',
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "JobSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Resume_storageKey_key" ON "Resume"("storageKey");

-- CreateIndex
CREATE INDEX "Resume_userId_deletedAt_createdAt_idx" ON "Resume"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeChunk_resumeId_ordinal_key" ON "ResumeChunk"("resumeId", "ordinal");

-- CreateIndex
CREATE INDEX "Interview_userId_createdAt_idx" ON "Interview"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Interview_resumeId_idx" ON "Interview"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_interviewId_ordinal_key" ON "Question"("interviewId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "Question_id_interviewId_key" ON "Question"("id", "interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_evaluationJobId_key" ON "Session"("evaluationJobId");

-- CreateIndex
CREATE INDEX "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_interviewId_status_idx" ON "Session"("interviewId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_interviewId_key" ON "Session"("id", "interviewId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_sessionId_questionId_key" ON "Answer"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_providerPriceId_key" ON "Plan"("providerPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_userId_key" ON "BillingCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_providerCustomerId_key" ON "BillingCustomer"("providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orderId_key" ON "Subscription"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_currentPeriodEnd_idx" ON "Subscription"("userId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_transactionId_key" ON "PaymentOrder"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_idempotencyKey_key" ON "PaymentOrder"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_payuId_key" ON "PaymentOrder"("payuId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_refundToken_key" ON "PaymentOrder"("refundToken");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_refundRequestId_key" ON "PaymentOrder"("refundRequestId");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_createdAt_idx" ON "PaymentOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_status_receivedAt_idx" ON "PaymentEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLedgerEntry_idempotencyKey_key" ON "UsageLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageLedgerEntry_userId_feature_periodKey_idx" ON "UsageLedgerEntry"("userId", "feature", "periodKey");

-- CreateIndex
CREATE INDEX "BackgroundJob_state_nextAttemptAt_idx" ON "BackgroundJob"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_ownerUserId_createdAt_idx" ON "BackgroundJob"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_resourceType_resourceId_kind_key" ON "BackgroundJob"("resourceType", "resourceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "JobSource_name_key" ON "JobSource"("name");

-- CreateIndex
CREATE INDEX "JobListing_active_expiresAt_postedAt_idx" ON "JobListing"("active", "expiresAt", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobListing_sourceId_externalId_key" ON "JobListing"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "JobSyncRun_sourceId_startedAt_idx" ON "JobSyncRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_idx" ON "AuditEvent"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeChunk" ADD CONSTRAINT "ResumeChunk_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_evaluationJobId_fkey" FOREIGN KEY ("evaluationJobId") REFERENCES "BackgroundJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_sessionId_interviewId_fkey" FOREIGN KEY ("sessionId", "interviewId") REFERENCES "Session"("id", "interviewId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_interviewId_fkey" FOREIGN KEY ("questionId", "interviewId") REFERENCES "Question"("id", "interviewId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobListing" ADD CONSTRAINT "JobListing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSyncRun" ADD CONSTRAINT "JobSyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma cannot express this partial uniqueness rule in the pinned client version.
CREATE UNIQUE INDEX "Resume_one_active_default_per_user" ON "Resume"("userId")
WHERE "isDefault" = true AND "deletedAt" IS NULL;
