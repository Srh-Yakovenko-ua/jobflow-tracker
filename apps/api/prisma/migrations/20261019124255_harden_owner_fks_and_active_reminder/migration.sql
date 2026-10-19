-- DropForeignKey
ALTER TABLE "ai_jobs" DROP CONSTRAINT "ai_jobs_application_id_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_application_id_fkey";

-- DropIndex
DROP INDEX "ai_jobs_application_id_idx";

-- DropIndex
DROP INDEX "reminders_application_id_idx";

-- CreateIndex
CREATE INDEX "ai_jobs_application_id_user_id_idx" ON "ai_jobs"("application_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_id_user_id_key" ON "applications"("id", "user_id");

-- CreateIndex
CREATE INDEX "reminders_application_id_user_id_idx" ON "reminders"("application_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_active_key" ON "reminders"("application_id", "type", "scheduled_event_id") NULLS NOT DISTINCT WHERE (status IN ('pending', 'snoozed'));

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_application_id_user_id_fkey" FOREIGN KEY ("application_id", "user_id") REFERENCES "applications"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_application_id_user_id_fkey" FOREIGN KEY ("application_id", "user_id") REFERENCES "applications"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
