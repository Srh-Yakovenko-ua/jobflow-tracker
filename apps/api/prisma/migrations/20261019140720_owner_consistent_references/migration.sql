-- DropForeignKey
ALTER TABLE "ai_jobs" DROP CONSTRAINT "ai_jobs_ai_result_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_jobs" DROP CONSTRAINT "ai_jobs_resume_version_id_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_resume_version_id_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_search_id_fkey";

-- DropForeignKey
ALTER TABLE "plans" DROP CONSTRAINT "plans_ai_result_id_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_scheduled_event_id_fkey";

-- DropForeignKey
ALTER TABLE "resume_versions" DROP CONSTRAINT "resume_versions_resume_id_fkey";

-- DropForeignKey
ALTER TABLE "stage_events" DROP CONSTRAINT "stage_events_compensates_event_id_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_active_resume_version_id_fkey";

-- DropIndex
DROP INDEX "ai_jobs_ai_result_id_idx";

-- DropIndex
DROP INDEX "ai_jobs_resume_version_id_idx";

-- DropIndex
DROP INDEX "applications_resume_version_id_idx";

-- DropIndex
DROP INDEX "applications_search_id_idx";

-- DropIndex
DROP INDEX "plans_ai_result_id_idx";

-- DropIndex
DROP INDEX "reminders_scheduled_event_id_idx";

-- DropIndex
DROP INDEX "resume_versions_resume_id_idx";

-- DropIndex
DROP INDEX "stage_events_compensates_event_id_key";

-- DropIndex
DROP INDEX "user_settings_active_resume_version_id_idx";

-- AlterTable
ALTER TABLE "resume_versions" ADD COLUMN "user_id" UUID;

UPDATE "resume_versions" AS v SET "user_id" = r."user_id" FROM "resumes" AS r WHERE r."id" = v."resume_id";

ALTER TABLE "resume_versions" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ai_jobs_ai_result_id_user_id_idx" ON "ai_jobs"("ai_result_id", "user_id");

-- CreateIndex
CREATE INDEX "ai_jobs_resume_version_id_user_id_idx" ON "ai_jobs"("resume_version_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_results_id_user_id_key" ON "ai_results"("id", "user_id");

-- CreateIndex
CREATE INDEX "applications_search_id_user_id_idx" ON "applications"("search_id", "user_id");

-- CreateIndex
CREATE INDEX "applications_resume_version_id_user_id_idx" ON "applications"("resume_version_id", "user_id");

-- CreateIndex
CREATE INDEX "plans_ai_result_id_user_id_idx" ON "plans"("ai_result_id", "user_id");

-- CreateIndex
CREATE INDEX "reminders_scheduled_event_id_application_id_idx" ON "reminders"("scheduled_event_id", "application_id");

-- CreateIndex
CREATE INDEX "resume_versions_user_id_resume_id_idx" ON "resume_versions"("user_id", "resume_id");

-- CreateIndex
CREATE UNIQUE INDEX "resume_versions_id_user_id_key" ON "resume_versions"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resumes_id_user_id_key" ON "resumes"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_events_id_application_id_key" ON "scheduled_events"("id", "application_id");

-- CreateIndex
CREATE UNIQUE INDEX "searches_id_user_id_key" ON "searches"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_events_id_application_id_key" ON "stage_events"("id", "application_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_events_compensates_event_id_application_id_key" ON "stage_events"("compensates_event_id", "application_id");

-- CreateIndex
CREATE INDEX "user_settings_active_resume_version_id_user_id_idx" ON "user_settings"("active_resume_version_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_active_resume_version_id_user_id_fkey" FOREIGN KEY ("active_resume_version_id", "user_id") REFERENCES "resume_versions"("id", "user_id") ON DELETE SET NULL ("active_resume_version_id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_search_id_user_id_fkey" FOREIGN KEY ("search_id", "user_id") REFERENCES "searches"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_version_id_user_id_fkey" FOREIGN KEY ("resume_version_id", "user_id") REFERENCES "resume_versions"("id", "user_id") ON DELETE SET NULL ("resume_version_id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_compensates_event_id_application_id_fkey" FOREIGN KEY ("compensates_event_id", "application_id") REFERENCES "stage_events"("id", "application_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_id_user_id_fkey" FOREIGN KEY ("resume_id", "user_id") REFERENCES "resumes"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_ai_result_id_user_id_fkey" FOREIGN KEY ("ai_result_id", "user_id") REFERENCES "ai_results"("id", "user_id") ON DELETE SET NULL ("ai_result_id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_resume_version_id_user_id_fkey" FOREIGN KEY ("resume_version_id", "user_id") REFERENCES "resume_versions"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_scheduled_event_id_application_id_fkey" FOREIGN KEY ("scheduled_event_id", "application_id") REFERENCES "scheduled_events"("id", "application_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_ai_result_id_user_id_fkey" FOREIGN KEY ("ai_result_id", "user_id") REFERENCES "ai_results"("id", "user_id") ON DELETE SET NULL ("ai_result_id") ON UPDATE CASCADE;

-- Grant
GRANT SELECT ("user_id") ON "resume_versions" TO jobflow_analytics;
