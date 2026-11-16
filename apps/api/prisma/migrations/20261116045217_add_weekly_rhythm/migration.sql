-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'rhythm_week_closed';

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "paused_from" DATE,
ADD COLUMN     "paused_until" DATE,
ADD COLUMN     "suggested_weekly_goal" INTEGER,
ADD COLUMN     "weekly_goal_applications" INTEGER,
ADD COLUMN     "weekly_goal_followups" INTEGER;
