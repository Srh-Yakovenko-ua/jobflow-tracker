-- CreateEnum
CREATE TYPE "stage" AS ENUM ('applied', 'screening', 'tech_interview', 'final', 'offer', 'rejected', 'ghosted', 'withdrawn');

-- CreateEnum
CREATE TYPE "source" AS ENUM ('djinni', 'dou', 'robota', 'workua', 'linkedin', 'referral', 'company_site', 'other');

-- CreateEnum
CREATE TYPE "work_mode" AS ENUM ('remote', 'hybrid', 'office');

-- CreateEnum
CREATE TYPE "rejection_side" AS ENUM ('company', 'candidate', 'system');

-- CreateEnum
CREATE TYPE "search_status" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "scheduled_event_kind" AS ENUM ('screening_call', 'tech_interview', 'final_interview', 'offer_call', 'other');

-- CreateEnum
CREATE TYPE "scheduled_event_status" AS ENUM ('planned', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "timeline_event_kind" AS ENUM ('captured', 'ai_parsed', 'silence_started', 'followup_generated', 'followup_sent', 'interview_scheduled', 'interview_done', 'note_added', 'resume_attached');

-- CreateTable
CREATE TABLE "searches" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "search_status" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "outcome" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "search_id" UUID NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "url" TEXT,
    "source" "source" NOT NULL,
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "currency" TEXT,
    "stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "work_mode" "work_mode",
    "current_stage" "stage" NOT NULL DEFAULT 'applied',
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "match_score" INTEGER,
    "ai_parsed" JSONB,
    "raw_text" TEXT,
    "applied_at" TIMESTAMPTZ,
    "last_event_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "application_id" UUID NOT NULL,
    "from_stage" "stage",
    "to_stage" "stage" NOT NULL,
    "reason_code" TEXT,
    "comment" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compensates_event_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "application_id" UUID NOT NULL,
    "kind" "timeline_event_kind" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rejection_reasons" (
    "code" TEXT NOT NULL,
    "side" "rejection_side" NOT NULL,
    "label_uk" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejection_reasons_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "application_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "telegram" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "application_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "application_id" UUID NOT NULL,
    "kind" "scheduled_event_kind" NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 60,
    "location_or_link" TEXT,
    "status" "scheduled_event_status" NOT NULL DEFAULT 'planned',
    "outcome_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "searches_user_id_idx" ON "searches"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "searches_user_id_active_key" ON "searches"("user_id") WHERE (status = 'active');

-- CreateIndex
CREATE INDEX "applications_user_id_current_stage_idx" ON "applications"("user_id", "current_stage");

-- CreateIndex
CREATE INDEX "applications_user_id_last_event_at_idx" ON "applications"("user_id", "last_event_at");

-- CreateIndex
CREATE INDEX "applications_search_id_idx" ON "applications"("search_id");

-- CreateIndex
CREATE INDEX "applications_search_vector_idx" ON "applications" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "stage_events_compensates_event_id_key" ON "stage_events"("compensates_event_id");

-- CreateIndex
CREATE INDEX "stage_events_application_id_occurred_at_idx" ON "stage_events"("application_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stage_events_reason_code_idx" ON "stage_events"("reason_code");

-- CreateIndex
CREATE INDEX "timeline_events_application_id_occurred_at_idx" ON "timeline_events"("application_id", "occurred_at");

-- CreateIndex
CREATE INDEX "contacts_application_id_idx" ON "contacts"("application_id");

-- CreateIndex
CREATE INDEX "notes_application_id_idx" ON "notes"("application_id");

-- CreateIndex
CREATE INDEX "scheduled_events_application_id_starts_at_idx" ON "scheduled_events"("application_id", "starts_at");

-- AddForeignKey
ALTER TABLE "searches" ADD CONSTRAINT "searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_reason_code_fkey" FOREIGN KEY ("reason_code") REFERENCES "rejection_reasons"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_compensates_event_id_fkey" FOREIGN KEY ("compensates_event_id") REFERENCES "stage_events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_events" ADD CONSTRAINT "scheduled_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION reject_append_only_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR pg_trigger_depth() = 1 THEN
        RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER stage_events_append_only
    BEFORE UPDATE OR DELETE ON "stage_events"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

CREATE TRIGGER timeline_events_append_only
    BEFORE UPDATE OR DELETE ON "timeline_events"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

CREATE FUNCTION applications_search_vector() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.company, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.position, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(NEW.stack, ' '), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.raw_text, '')), 'C');
    RETURN NEW;
END;
$$;

CREATE TRIGGER applications_search_vector_fill
    BEFORE INSERT OR UPDATE OF "company", "position", "stack", "raw_text" ON "applications"
    FOR EACH ROW EXECUTE FUNCTION applications_search_vector();

ALTER TABLE "applications" ADD CONSTRAINT "applications_match_score_check" CHECK ("match_score" IS NULL OR "match_score" BETWEEN 0 AND 100);

ALTER TABLE "applications" ADD CONSTRAINT "applications_salary_range_check" CHECK ("salary_min" IS NULL OR "salary_max" IS NULL OR "salary_min" <= "salary_max");

ALTER TABLE "scheduled_events" ADD CONSTRAINT "scheduled_events_duration_min_check" CHECK ("duration_min" > 0);

REVOKE SELECT ON "contacts", "notes" FROM jobflow_analytics;
