-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_resumeId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_interviewId_fkey";

-- AlterTable
ALTER TABLE "ScraperConfig" ALTER COLUMN "keywords" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "enabledSources" SET DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Interview_id_userId_key" ON "Interview"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Resume_id_userId_key" ON "Resume"("id", "userId");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_resumeId_userId_fkey" FOREIGN KEY ("resumeId", "userId") REFERENCES "Resume"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_interviewId_userId_fkey" FOREIGN KEY ("interviewId", "userId") REFERENCES "Interview"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce values and identity invariants at the database boundary as well as
-- in request validation. Prisma does not currently model CHECK constraints.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));
ALTER TABLE "User" ADD CONSTRAINT "User_credits_nonnegative" CHECK ("credits" >= 0);
ALTER TABLE "User" ADD CONSTRAINT "User_sessions_nonnegative" CHECK ("totalSessions" >= 0);
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_size_nonnegative" CHECK ("sizeBytes" >= 0);
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_question_count_valid" CHECK ("questionCount" BETWEEN 0 AND 20);
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_score_valid" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 10);
ALTER TABLE "Session" ADD CONSTRAINT "Session_score_valid" CHECK ("overallScore" IS NULL OR "overallScore" BETWEEN 0 AND 100);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_amount_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_entitlements_nonnegative" CHECK ("credits" >= 0 AND "durationDays" > 0);
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_entitlements_positive" CHECK ("creditLimit" > 0 AND "durationDays" > 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_period_valid" CHECK ("currentPeriodEnd" > "currentPeriodStart" AND "creditLimit" > 0);
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_units_nonnegative" CHECK ("units" >= 0);
ALTER TABLE "JobListing" ADD CONSTRAINT "JobListing_salary_nonnegative" CHECK (("salaryMin" IS NULL OR "salaryMin" >= 0) AND ("salaryMax" IS NULL OR "salaryMax" >= 0));
ALTER TABLE "LegacyTransaction" ADD CONSTRAINT "LegacyTransaction_amount_nonnegative" CHECK ("amountMinor" >= 0);
