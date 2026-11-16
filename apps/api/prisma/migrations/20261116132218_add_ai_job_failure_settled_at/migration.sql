-- AlterTable
ALTER TABLE "ai_jobs" ADD COLUMN     "failure_settled_at" TIMESTAMPTZ;

UPDATE "ai_jobs" SET "failure_settled_at" = COALESCE("finished_at", "updated_at") WHERE "status" = 'failed';
