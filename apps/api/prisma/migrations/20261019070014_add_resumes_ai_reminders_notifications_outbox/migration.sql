-- CreateEnum
CREATE TYPE "reminder_type" AS ENUM ('followup', 'interview_soon');

-- CreateEnum
CREATE TYPE "reminder_status" AS ENUM ('pending', 'done', 'snoozed', 'dismissed');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('silence', 'interview_soon', 'ai_done', 'ai_failed', 'monthly_summary_ready', 'insight_unlocked', 'plan_item_due');

-- CreateEnum
CREATE TYPE "ai_job_status" AS ENUM ('queued', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "ai_result_status" AS ENUM ('succeeded', 'failed');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "resume_version_id" UUID;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "active_resume_version_id" UUID;

-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_versions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "resume_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "text_extracted" TEXT,
    "ai_profile" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_results" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "output" JSONB,
    "model" TEXT NOT NULL,
    "tokens_in" INTEGER NOT NULL,
    "tokens_out" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "status" "ai_result_status" NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "ai_job_status" NOT NULL DEFAULT 'queued',
    "step" INTEGER NOT NULL DEFAULT 0,
    "error_type" TEXT,
    "ai_result_id" UUID,
    "application_id" UUID,
    "resume_version_id" UUID,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "scheduled_event_id" UUID,
    "type" "reminder_type" NOT NULL,
    "status" "reminder_status" NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMPTZ NOT NULL,
    "snoozed_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_success_at" TIMESTAMPTZ,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "aggregate" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "ai_result_id" UUID,
    "title" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "plan_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT,
    "expected_effect" TEXT,
    "metric" TEXT,
    "due_at" TIMESTAMPTZ,
    "done_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumes_user_id_idx" ON "resumes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resume_versions_storage_key_key" ON "resume_versions"("storage_key");

-- CreateIndex
CREATE INDEX "resume_versions_resume_id_idx" ON "resume_versions"("resume_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_results_user_id_kind_input_hash_key" ON "ai_results"("user_id", "kind", "input_hash");

-- CreateIndex
CREATE INDEX "ai_jobs_user_id_created_at_idx" ON "ai_jobs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_jobs_status_created_at_idx" ON "ai_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_jobs_ai_result_id_idx" ON "ai_jobs"("ai_result_id");

-- CreateIndex
CREATE INDEX "ai_jobs_application_id_idx" ON "ai_jobs"("application_id");

-- CreateIndex
CREATE INDEX "ai_jobs_resume_version_id_idx" ON "ai_jobs"("resume_version_id");

-- CreateIndex
CREATE INDEX "reminders_user_id_status_due_at_idx" ON "reminders"("user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "reminders_application_id_idx" ON "reminders"("application_id");

-- CreateIndex
CREATE INDEX "reminders_scheduled_event_id_idx" ON "reminders"("scheduled_event_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "outbox_unpublished_idx" ON "outbox"("created_at") WHERE (published_at IS NULL);

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_key" ON "idempotency_keys"("user_id", "key");

-- CreateIndex
CREATE INDEX "plans_user_id_month_idx" ON "plans"("user_id", "month");

-- CreateIndex
CREATE INDEX "plans_ai_result_id_idx" ON "plans"("ai_result_id");

-- CreateIndex
CREATE INDEX "plan_items_plan_id_position_idx" ON "plan_items"("plan_id", "position");

-- CreateIndex
CREATE INDEX "applications_resume_version_id_idx" ON "applications"("resume_version_id");

-- CreateIndex
CREATE INDEX "user_settings_active_resume_version_id_idx" ON "user_settings"("active_resume_version_id");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_active_resume_version_id_fkey" FOREIGN KEY ("active_resume_version_id") REFERENCES "resume_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_results" ADD CONSTRAINT "ai_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_ai_result_id_fkey" FOREIGN KEY ("ai_result_id") REFERENCES "ai_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_scheduled_event_id_fkey" FOREIGN KEY ("scheduled_event_id") REFERENCES "scheduled_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_ai_result_id_fkey" FOREIGN KEY ("ai_result_id") REFERENCES "ai_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_size_bytes_check" CHECK ("size_bytes" > 0);

ALTER TABLE "ai_results" ADD CONSTRAINT "ai_results_counts_check" CHECK ("tokens_in" >= 0 AND "tokens_out" >= 0 AND "latency_ms" >= 0);

REVOKE SELECT ON "push_subscriptions", "idempotency_keys", "outbox", "notifications", "ai_results", "ai_jobs", "resume_versions" FROM jobflow_analytics;

GRANT SELECT ("id", "resume_id", "title", "is_archived", "uploaded_at", "created_at", "updated_at") ON "resume_versions" TO jobflow_analytics;
