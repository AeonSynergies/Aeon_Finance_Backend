/*
  Warnings:

  - The `module` column on the `jobs` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "JobModule" AS ENUM ('TIMECARD');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "lockedAt" TIMESTAMP(3),
DROP COLUMN "module",
ADD COLUMN     "module" "JobModule" NOT NULL DEFAULT 'TIMECARD';
