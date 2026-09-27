-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "answerAudio" TEXT,
ADD COLUMN     "followupUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "questionText" TEXT;

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "category" TEXT,
ADD COLUMN     "details" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'success';

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "generationAttemptId" TEXT,
ADD COLUMN     "generationStartedAt" TIMESTAMP(3),
ADD COLUMN     "questionTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "JobListing" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "category" TEXT DEFAULT 'General',
ADD COLUMN     "contractType" TEXT DEFAULT 'full_time',
ADD COLUMN     "experience" TEXT DEFAULT 'Not Specified',
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobHash" TEXT,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postedById" UUID,
ADD COLUMN     "salaryMax" DOUBLE PRECISION,
ADD COLUMN     "salaryMin" DOUBLE PRECISION,
ADD COLUMN     "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PaymentEvent" ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "callbackEmailTag" TEXT,
ADD COLUMN     "callbackPhoneTag" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "failureCode" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastReconciledAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "productInfo" TEXT,
ADD COLUMN     "reconcileLeaseUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "coupons" JSONB,
ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "directDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "durationDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "postedById" UUID;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'pdf',
ADD COLUMN     "legacyFileUrl" TEXT;

-- AlterTable
ALTER TABLE "UsageLedgerEntry" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'committed';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLogin" TIMESTAMP(3),
ADD COLUMN     "totalSessions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "periodKey" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID,
    "transactionId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invoiceUrl" TEXT,
    "paymentMethod" TEXT,
    "refundReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "duration" INTEGER NOT NULL DEFAULT 30,
    "questionCount" INTEGER NOT NULL DEFAULT 5,
    "systemPrompt" TEXT NOT NULL,
    "evaluationPrompt" TEXT NOT NULL,
    "feedbackPrompt" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL DEFAULT 'alloy',
    "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "voicePitch" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'en',
    "postedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "history" JSONB,
    "lastUpdatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" UUID NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'system',
    "general" JSONB NOT NULL,
    "security" JSONB NOT NULL,
    "ai" JSONB NOT NULL,
    "storage" JSONB NOT NULL,
    "featureFlags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperConfig" (
    "id" UUID NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'scraper',
    "scrapeInterval" INTEGER NOT NULL DEFAULT 60,
    "maxJobs" INTEGER NOT NULL DEFAULT 50,
    "keywords" TEXT[],
    "country" TEXT NOT NULL DEFAULT 'us',
    "remoteOnly" BOOLEAN NOT NULL DEFAULT true,
    "enabledSources" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'idle',
    "isActiveScheduler" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperLog" (
    "id" UUID NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "jobsImported" INTEGER NOT NULL DEFAULT 0,
    "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_periodKey_key" ON "UsageCounter"("userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyTransaction_transactionId_key" ON "LegacyTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "LegacyTransaction_userId_createdAt_idx" ON "LegacyTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewTemplate_postedById_createdAt_idx" ON "InterviewTemplate"("postedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_category_key" ON "SystemPrompt"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_singletonKey_key" ON "SystemSetting"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScraperConfig_singletonKey_key" ON "ScraperConfig"("singletonKey");

-- CreateIndex
CREATE INDEX "ScraperLog_startTime_idx" ON "ScraperLog"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "JobListing_jobHash_key" ON "JobListing"("jobHash");

-- CreateIndex
CREATE INDEX "JobListing_category_contractType_location_idx" ON "JobListing"("category", "contractType", "location");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobListing" ADD CONSTRAINT "JobListing_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyTransaction" ADD CONSTRAINT "LegacyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyTransaction" ADD CONSTRAINT "LegacyTransaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewTemplate" ADD CONSTRAINT "InterviewTemplate_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemPrompt" ADD CONSTRAINT "SystemPrompt_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
