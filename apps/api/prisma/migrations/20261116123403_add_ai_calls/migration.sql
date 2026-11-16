-- CreateTable
CREATE TABLE "ai_calls" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "ai_result_status" NOT NULL,
    "error_type" TEXT,
    "tokens_in" INTEGER NOT NULL,
    "tokens_out" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_calls_user_id_created_at_idx" ON "ai_calls"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_calls_created_at_idx" ON "ai_calls"("created_at");

-- AddForeignKey
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ai_calls" ("user_id", "kind", "model", "status", "error_type", "tokens_in", "tokens_out", "latency_ms", "created_at", "updated_at")
SELECT "user_id", "kind", "model", "status", "error", "tokens_in", "tokens_out", "latency_ms", "updated_at", "updated_at" FROM "ai_results";

REVOKE SELECT ON "ai_calls" FROM jobflow_analytics;
