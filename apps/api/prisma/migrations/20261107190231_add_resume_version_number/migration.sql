-- AlterTable
ALTER TABLE "resume_versions" ADD COLUMN "number" INTEGER;

UPDATE "resume_versions" AS v SET "number" = numbered."number"
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "resume_id" ORDER BY "uploaded_at", "id") AS "number"
  FROM "resume_versions"
) AS numbered
WHERE numbered."id" = v."id";

ALTER TABLE "resume_versions" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "resume_versions_resume_id_number_key" ON "resume_versions"("resume_id", "number");

-- Grant
GRANT SELECT ("number") ON "resume_versions" TO jobflow_analytics;
