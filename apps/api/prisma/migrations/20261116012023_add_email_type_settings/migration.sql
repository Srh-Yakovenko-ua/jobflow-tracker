-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "email_interview_prep" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email_monthly_summary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email_silence" BOOLEAN NOT NULL DEFAULT true;
