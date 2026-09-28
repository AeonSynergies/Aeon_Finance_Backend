-- AlterTable
ALTER TABLE "timecard_rows" ADD COLUMN     "additionalTriggeredRules" JSONB NOT NULL DEFAULT '[]';
