-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "evaluationStartedAt" TIMESTAMP(3);

-- At most one unfinished session per candidate and interview. Prisma cannot
-- express this partial index, so keep it in a SQL migration.
CREATE UNIQUE INDEX "Session_one_active_per_interview_user" ON "Session" ("userId", "interviewId")
WHERE "status" IN ('started', 'in_progress', 'evaluating', 'evaluation_failed');
